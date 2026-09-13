/**
 * Pure billing math for check-out flow.
 *
 * Extracted from CheckOutModal so it can be unit-tested without React, Firebase, or IndexedDB.
 * No I/O, no Date.now() side effects (caller passes `now` when needed).
 */

export const KIDS_PLAN_FREE_MINUTES = 180;
export const EMPLOYEE_DISCOUNT_RATIO = 0.5;

export interface BillingPackage {
  id: string;
  type: string;
  hours: number;
  usedHours: number;
}

export interface MultiPackageCoverage {
  breakdown: { pkg: BillingPackage; coveredMin: number }[];
  totalCoveredMin: number;
  excessMin: number;
  billableExcessMin: number;
  principalBillable: number;
  totalBillableMinutes: number;
  isPartial: boolean;
  isFullyCovered: boolean;
  hasPackages: boolean;
}

export interface KidsPlanCoverage {
  coveredMin: number;
  excessMin: number;
  billableExcessMin: number;
  isPartial: boolean;
  isFullyCovered: boolean;
}

/**
 * Calcula cobertura de múltiplos pacotes do menor para o maior.
 * @param packages    pacotes candidatos (esgotados são ignorados)
 * @param durationMin duração principal em minutos
 * @param minimumTime tempo mínimo cobrado (ex: 30min)
 * @param extraMinutes minutos faturáveis adicionais de irmãos incluídos
 */
export function calculateMultiPackageCoverage(
  packages: BillingPackage[],
  durationMin: number,
  minimumTime: number,
  extraMinutes: number = 0,
): MultiPackageCoverage {
  const sorted = packages
    .filter((p) => p.hours - p.usedHours > 0)
    .slice()
    .sort((a, b) => a.hours - a.usedHours - (b.hours - b.usedHours));

  const principalBillable = Math.max(durationMin, minimumTime);
  const totalBillableMinutes = principalBillable + extraMinutes;
  let remainingToCover = totalBillableMinutes;
  const breakdown: { pkg: BillingPackage; coveredMin: number }[] = [];

  for (const pkg of sorted) {
    if (remainingToCover <= 0) break;
    const pkgRemainingMin = Math.round((pkg.hours - pkg.usedHours) * 60);
    const covered = Math.min(pkgRemainingMin, remainingToCover);
    if (covered > 0) {
      breakdown.push({ pkg, coveredMin: covered });
      remainingToCover -= covered;
    }
  }

  const totalCoveredMin = breakdown.reduce((sum, b) => sum + b.coveredMin, 0);
  const excessMin = Math.max(0, totalBillableMinutes - totalCoveredMin);
  const billableExcessMin = excessMin > 0 ? Math.max(excessMin, minimumTime) : 0;

  return {
    breakdown,
    totalCoveredMin,
    excessMin,
    billableExcessMin,
    principalBillable,
    totalBillableMinutes,
    isPartial: excessMin > 0 && totalCoveredMin > 0,
    isFullyCovered: excessMin === 0 && totalCoveredMin > 0,
    hasPackages: sorted.length > 0,
  };
}

/**
 * Cobertura do Plano Kids — 3h grátis por dia, excedente aplica tempo mínimo.
 */
export function calculateKidsPlanCoverage(
  durationMin: number,
  minimumTime: number,
  freeMin: number = KIDS_PLAN_FREE_MINUTES,
): KidsPlanCoverage {
  const safeDur = Math.max(0, durationMin);
  const excessMin = Math.max(0, safeDur - freeMin);
  const coveredMin = Math.min(safeDur, freeMin);
  const billableExcessMin = excessMin > 0 ? Math.max(excessMin, minimumTime) : 0;
  return {
    coveredMin,
    excessMin,
    billableExcessMin,
    isPartial: excessMin > 0,
    isFullyCovered: excessMin === 0,
  };
}

/**
 * Calcula valor cobrado da visita principal segundo a forma de pagamento ativa.
 * - kids plan: cobra só excedente acima de 180min
 * - pacote: cobra só excedente do que o pacote não cobriu (principal portion)
 * - avulso: cobra hora × hourlyRate, com mínimo e desconto colaborador (50%)
 */
export function calculatePrincipalValue(params: {
  isKidsPlan: boolean;
  usePackages: boolean;
  durationMin: number;
  minimumTime: number;
  hourlyRate: number;
  employeeDiscount?: boolean;
  multiCoverage?: MultiPackageCoverage;
  kidsCoverage?: KidsPlanCoverage;
}): number {
  const {
    isKidsPlan,
    usePackages,
    durationMin,
    minimumTime,
    hourlyRate,
    employeeDiscount,
    multiCoverage,
    kidsCoverage,
  } = params;

  if (isKidsPlan && kidsCoverage) {
    return kidsCoverage.billableExcessMin > 0
      ? round2((kidsCoverage.billableExcessMin / 60) * hourlyRate)
      : 0;
  }

  if (usePackages && multiCoverage) {
    if (multiCoverage.isFullyCovered) return 0;
    if (multiCoverage.excessMin > 0) {
      const principalCovered = Math.min(multiCoverage.totalCoveredMin, multiCoverage.principalBillable);
      const principalExcess = multiCoverage.principalBillable - principalCovered;
      return principalExcess > 0
        ? round2((Math.max(principalExcess, minimumTime) / 60) * hourlyRate)
        : 0;
    }
    return 0;
  }

  // Avulso
  const billableMinutes = Math.max(durationMin, minimumTime);
  let v = (billableMinutes / 60) * hourlyRate;
  if (employeeDiscount) v *= EMPLOYEE_DISCOUNT_RATIO;
  return round2(v);
}

/**
 * Recalcula duração em minutos a partir de um checkIn e um instante "agora".
 * Sempre arredonda PARA CIMA (cliente que ficou 30s já conta 1min).
 * Nunca retorna negativo (proteção contra relógio inconsistente).
 */
export function recalcDurationMinutes(
  checkIn: Date | string | undefined | null,
  now: number = Date.now(),
): number {
  if (!checkIn) return 0;
  const t = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const tMs = t.getTime();
  if (Number.isNaN(tMs)) return 0;
  return Math.max(0, Math.ceil((now - tMs) / (1000 * 60)));
}

/**
 * Distribui sobra do pacote (após o principal) entre irmãos não-Kids.
 * Retorna o valor a cobrar de cada irmão e se ele consumiu pacote.
 *
 * IMPORTANTE: irmãos com Kids Plan não usam o pacote do responsável — devem ser
 * tratados separadamente pelo chamador via calculateKidsPlanCoverage.
 */
export function distributeSiblingCoverageOverPackage(
  multiCoverage: MultiPackageCoverage,
  siblings: { durationMin: number; isKidsPlan: boolean }[],
  minimumTime: number,
  hourlyRate: number,
  employeeDiscount: boolean = false,
): { sibValue: number; sibUsedPackage: boolean }[] {
  const principalCovered = Math.min(multiCoverage.totalCoveredMin, multiCoverage.principalBillable);
  let remainingPkgMin = Math.max(0, multiCoverage.totalCoveredMin - principalCovered);

  return siblings.map((sib) => {
    if (sib.isKidsPlan) {
      // Calcular Kids Plan separadamente (não consome o pacote)
      const kc = calculateKidsPlanCoverage(sib.durationMin, minimumTime);
      const v = kc.billableExcessMin > 0
        ? round2((kc.billableExcessMin / 60) * hourlyRate)
        : 0;
      return { sibValue: v, sibUsedPackage: false };
    }
    const sibBillable = Math.max(sib.durationMin, minimumTime);
    const sibCovered = Math.min(remainingPkgMin, sibBillable);
    remainingPkgMin -= sibCovered;
    const sibExcess = sibBillable - sibCovered;
    let sibValue = 0;
    if (sibExcess > 0) {
      let v = (Math.max(sibExcess, minimumTime) / 60) * hourlyRate;
      if (employeeDiscount) v *= EMPLOYEE_DISCOUNT_RATIO;
      sibValue = round2(v);
    }
    return { sibValue, sibUsedPackage: sibCovered > 0 && sibExcess === 0 };
  });
}

/** Um irmão candidato a ser fechado junto com a visita principal. */
export interface SiblingBillingInput {
  durationMin: number;
  isKidsPlan: boolean;
}

/**
 * Valor de cada irmão INCLUÍDO no check-out, na ordem recebida.
 *
 * Fonte única para a pré-visualização do modal e para a cobrança: quando as
 * duas divergem, o operador vê um valor na tela e o cliente paga outro.
 */
export function calculateIncludedSiblingValues(params: {
  /** true quando a visita principal está quitando via pacote. */
  principalUsesPackage: boolean;
  includedSiblings: SiblingBillingInput[];
  /** Cobertura do pacote — obrigatória quando `principalUsesPackage`. */
  multiCoverage?: MultiPackageCoverage;
  minimumTime: number;
  hourlyRate: number;
  employeeDiscount?: boolean;
}): { sibValue: number; sibUsedPackage: boolean }[] {
  const {
    principalUsesPackage,
    includedSiblings,
    multiCoverage,
    minimumTime,
    hourlyRate,
    employeeDiscount = false,
  } = params;

  // Sem pacote no principal, cada irmão é calculado por conta própria.
  if (!principalUsesPackage || !multiCoverage) {
    return includedSiblings.map((sib) => {
      if (sib.isKidsPlan) {
        const kc = calculateKidsPlanCoverage(sib.durationMin, minimumTime);
        return {
          sibValue: kc.billableExcessMin > 0 ? round2((kc.billableExcessMin / 60) * hourlyRate) : 0,
          sibUsedPackage: false,
        };
      }
      return {
        sibValue: calculateSiblingAvulsoValue(sib.durationMin, minimumTime, hourlyRate, employeeDiscount),
        sibUsedPackage: false,
      };
    });
  }

  // Com pacote, a sobra depois do principal é distribuída entre os irmãos.
  return distributeSiblingCoverageOverPackage(
    multiCoverage,
    includedSiblings,
    minimumTime,
    hourlyRate,
    employeeDiscount,
  );
}

/**
 * Valor avulso para um irmão (sem pacote, sem Kids Plan).
 */
export function calculateSiblingAvulsoValue(
  durationMin: number,
  minimumTime: number,
  hourlyRate: number,
  employeeDiscount: boolean = false,
): number {
  const billable = Math.max(durationMin, minimumTime);
  let v = (billable / 60) * hourlyRate;
  if (employeeDiscount) v *= EMPLOYEE_DISCOUNT_RATIO;
  return round2(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Tolerância de saldo ao debitar um pacote, em horas (1 minuto).
 *
 * `calculateMultiPackageCoverage` arredonda o saldo para minutos inteiros
 * (`Math.round`), então uma cobertura pode pedir até 0,5min a mais do que o
 * pacote realmente tem quando `hours`/`usedHours` são fracionários — o que
 * acontece sempre que um pacote é renovado carregando o saldo anterior
 * (ex.: 20h + 0,9666h = 20,9666h). O débito precisa aceitar essa diferença de
 * arredondamento; o excedente é absorvido pelo clamp em `pkg.hours`.
 */
export const PACKAGE_DEDUCTION_TOLERANCE_HOURS = 1 / 60;

/**
 * Resolve o débito de horas de um pacote.
 *
 * Lança se o pedido ultrapassar o saldo por mais que o arredondamento de
 * minutos; caso contrário devolve o novo `usedHours` (limitado ao total do
 * pacote) e se ele continua ativo.
 */
export function resolvePackageDeduction(
  pkg: { hours?: number; usedHours?: number },
  hoursRequested: number,
): { newUsedHours: number; active: boolean } {
  const totalHours = pkg.hours || 0;
  const usedHours = pkg.usedHours || 0;
  const availableHours = Math.max(0, totalHours - usedHours);

  if (hoursRequested - availableHours > PACKAGE_DEDUCTION_TOLERANCE_HOURS) {
    throw new Error(
      `saldo insuficiente (precisa de ${Math.round(hoursRequested * 60)}min, ` +
      `restam ${Math.round(availableHours * 60)}min)`,
    );
  }

  const newUsedHours = Math.min(totalHours, usedHours + hoursRequested);
  return {
    newUsedHours,
    active: totalHours - newUsedHours > PACKAGE_DEDUCTION_TOLERANCE_HOURS,
  };
}
