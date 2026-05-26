import { describe, it, expect } from 'vitest';
import {
  KIDS_PLAN_FREE_MINUTES,
  calculateKidsPlanCoverage,
  calculateMultiPackageCoverage,
  calculatePrincipalValue,
  calculateSiblingAvulsoValue,
  distributeSiblingCoverageOverPackage,
  recalcDurationMinutes,
} from './billing';

const pkg = (id: string, hours: number, used: number = 0) => ({
  id,
  type: `${hours}h`,
  hours,
  usedHours: used,
});

describe('calculateKidsPlanCoverage', () => {
  it('cobre integralmente quando duração <= 180min', () => {
    const r = calculateKidsPlanCoverage(120, 30);
    expect(r.isFullyCovered).toBe(true);
    expect(r.isPartial).toBe(false);
    expect(r.excessMin).toBe(0);
    expect(r.coveredMin).toBe(120);
    expect(r.billableExcessMin).toBe(0);
  });

  it('cobre exatamente até 180min', () => {
    const r = calculateKidsPlanCoverage(180, 30);
    expect(r.isFullyCovered).toBe(true);
    expect(r.coveredMin).toBe(180);
  });

  it('aplica tempo mínimo (30min) quando excedente é pequeno', () => {
    const r = calculateKidsPlanCoverage(185, 30);
    expect(r.excessMin).toBe(5);
    expect(r.billableExcessMin).toBe(30);
    expect(r.isPartial).toBe(true);
  });

  it('não aplica mínimo quando excedente é maior', () => {
    const r = calculateKidsPlanCoverage(240, 30);
    expect(r.excessMin).toBe(60);
    expect(r.billableExcessMin).toBe(60);
  });

  it('aceita duração 0 sem erro', () => {
    const r = calculateKidsPlanCoverage(0, 30);
    expect(r.coveredMin).toBe(0);
    expect(r.excessMin).toBe(0);
    expect(r.isFullyCovered).toBe(true);
  });

  it('protege contra duração negativa', () => {
    const r = calculateKidsPlanCoverage(-10, 30);
    expect(r.coveredMin).toBe(0);
    expect(r.excessMin).toBe(0);
  });

  it('constante KIDS_PLAN_FREE_MINUTES é 180', () => {
    expect(KIDS_PLAN_FREE_MINUTES).toBe(180);
  });
});

describe('calculateMultiPackageCoverage', () => {
  it('cobre integralmente com pacote tendo horas suficientes', () => {
    const r = calculateMultiPackageCoverage([pkg('p1', 10)], 60, 30);
    expect(r.isFullyCovered).toBe(true);
    expect(r.totalCoveredMin).toBe(60);
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0].coveredMin).toBe(60);
  });

  it('aplica tempo mínimo na duração antes de cobrir', () => {
    const r = calculateMultiPackageCoverage([pkg('p1', 10)], 10, 30);
    expect(r.principalBillable).toBe(30);
    expect(r.totalCoveredMin).toBe(30);
    expect(r.breakdown[0].coveredMin).toBe(30);
  });

  it('cobertura parcial gera excedente com tempo mínimo', () => {
    const r = calculateMultiPackageCoverage([pkg('p1', 1, 0.5)], 60, 30); // 30min restantes
    expect(r.isPartial).toBe(true);
    expect(r.totalCoveredMin).toBe(30);
    expect(r.excessMin).toBe(30);
    expect(r.billableExcessMin).toBe(30);
  });

  it('múltiplos pacotes: consome do menor saldo primeiro', () => {
    const r = calculateMultiPackageCoverage([pkg('grande', 10), pkg('pequeno', 1)], 90, 30);
    expect(r.breakdown[0].pkg.id).toBe('pequeno');
    expect(r.breakdown[0].coveredMin).toBe(60);
    expect(r.breakdown[1].pkg.id).toBe('grande');
    expect(r.breakdown[1].coveredMin).toBe(30);
  });

  it('ignora pacotes esgotados', () => {
    const r = calculateMultiPackageCoverage([pkg('cheio', 10, 10), pkg('saldo', 5)], 60, 30);
    expect(r.breakdown).toHaveLength(1);
    expect(r.breakdown[0].pkg.id).toBe('saldo');
  });

  it('extraMinutes de irmãos aumenta o total cobrado', () => {
    const r = calculateMultiPackageCoverage([pkg('p1', 10)], 60, 30, 60);
    expect(r.totalBillableMinutes).toBe(120);
    expect(r.totalCoveredMin).toBe(120);
  });

  it('sem pacotes: hasPackages=false e nada coberto', () => {
    const r = calculateMultiPackageCoverage([], 60, 30);
    expect(r.hasPackages).toBe(false);
    expect(r.breakdown).toHaveLength(0);
    expect(r.totalCoveredMin).toBe(0);
    expect(r.isFullyCovered).toBe(false);
  });

  it('CENÁRIO BUG 10h: pacote de 10h, 30min visita → desconta 0.5h', () => {
    const r = calculateMultiPackageCoverage([pkg('10h', 10)], 30, 30);
    expect(r.isFullyCovered).toBe(true);
    expect(r.totalCoveredMin).toBe(30);
    const hoursToDeduct = r.breakdown[0].coveredMin / 60;
    expect(hoursToDeduct).toBe(0.5);
  });

  it('não muta o array de entrada (passa cópia ordenada)', () => {
    const input = [pkg('grande', 10), pkg('pequeno', 1)];
    const inputBefore = JSON.stringify(input);
    calculateMultiPackageCoverage(input, 60, 30);
    expect(JSON.stringify(input)).toBe(inputBefore);
  });
});

describe('calculatePrincipalValue', () => {
  it('avulso: cobra hora cheia quando excede mínimo', () => {
    const v = calculatePrincipalValue({
      isKidsPlan: false, usePackages: false,
      durationMin: 60, minimumTime: 30, hourlyRate: 30,
    });
    expect(v).toBe(30);
  });

  it('avulso: aplica mínimo para curta duração', () => {
    const v = calculatePrincipalValue({
      isKidsPlan: false, usePackages: false,
      durationMin: 10, minimumTime: 30, hourlyRate: 30,
    });
    expect(v).toBe(15); // 30min / 60 * 30
  });

  it('avulso com desconto colaborador: aplica 50%', () => {
    const v = calculatePrincipalValue({
      isKidsPlan: false, usePackages: false,
      durationMin: 60, minimumTime: 30, hourlyRate: 30,
      employeeDiscount: true,
    });
    expect(v).toBe(15);
  });

  it('pacote totalmente coberto: zero', () => {
    const cov = calculateMultiPackageCoverage([pkg('p', 10)], 60, 30);
    const v = calculatePrincipalValue({
      isKidsPlan: false, usePackages: true,
      durationMin: 60, minimumTime: 30, hourlyRate: 30,
      multiCoverage: cov,
    });
    expect(v).toBe(0);
  });

  it('pacote parcial: cobra excedente do principal', () => {
    const cov = calculateMultiPackageCoverage([pkg('p', 1, 0.5)], 90, 30); // 30min
    const v = calculatePrincipalValue({
      isKidsPlan: false, usePackages: true,
      durationMin: 90, minimumTime: 30, hourlyRate: 30,
      multiCoverage: cov,
    });
    // principal=90, coberto=30, excedente=60 → 60min × 30/h = 30
    expect(v).toBe(30);
  });

  it('kids plan totalmente coberto: zero', () => {
    const cov = calculateKidsPlanCoverage(120, 30);
    const v = calculatePrincipalValue({
      isKidsPlan: true, usePackages: false,
      durationMin: 120, minimumTime: 30, hourlyRate: 30,
      kidsCoverage: cov,
    });
    expect(v).toBe(0);
  });

  it('kids plan excedente: cobra só o excedente', () => {
    const cov = calculateKidsPlanCoverage(220, 30); // 40min excedente
    const v = calculatePrincipalValue({
      isKidsPlan: true, usePackages: false,
      durationMin: 220, minimumTime: 30, hourlyRate: 30,
      kidsCoverage: cov,
    });
    expect(v).toBe(20); // 40/60 × 30 = 20
  });

  it('REGRESSÃO: 30min com pacote 10h → R$ 0 (não R$ 15 de avulso)', () => {
    const cov = calculateMultiPackageCoverage([pkg('10h', 10)], 30, 30);
    const v = calculatePrincipalValue({
      isKidsPlan: false, usePackages: true,
      durationMin: 30, minimumTime: 30, hourlyRate: 30,
      multiCoverage: cov,
    });
    expect(v).toBe(0);
  });
});

describe('calculateSiblingAvulsoValue', () => {
  it('cobra hora cheia para irmão sem pacote', () => {
    expect(calculateSiblingAvulsoValue(60, 30, 30)).toBe(30);
  });
  it('aplica mínimo de tempo', () => {
    expect(calculateSiblingAvulsoValue(5, 30, 30)).toBe(15);
  });
  it('aplica desconto colaborador 50%', () => {
    expect(calculateSiblingAvulsoValue(60, 30, 30, true)).toBe(15);
  });
});

describe('distributeSiblingCoverageOverPackage', () => {
  it('com sobra suficiente, irmão fica totalmente coberto', () => {
    const cov = calculateMultiPackageCoverage([pkg('p', 2)], 60, 30, 60); // 120min disponível
    const r = distributeSiblingCoverageOverPackage(
      cov, [{ durationMin: 60, isKidsPlan: false }], 30, 30,
    );
    expect(r[0].sibValue).toBe(0);
    expect(r[0].sibUsedPackage).toBe(true);
  });

  it('sem sobra, irmão paga avulso', () => {
    // pacote 1h cobre só o principal (60min), nada sobra
    const cov = calculateMultiPackageCoverage([pkg('p', 1)], 60, 30, 60);
    const r = distributeSiblingCoverageOverPackage(
      cov, [{ durationMin: 60, isKidsPlan: false }], 30, 30,
    );
    expect(r[0].sibValue).toBe(30);
    expect(r[0].sibUsedPackage).toBe(false);
  });

  it('irmão Kids Plan: ignora pacote, cobra só excedente', () => {
    const cov = calculateMultiPackageCoverage([pkg('p', 2)], 60, 30);
    const r = distributeSiblingCoverageOverPackage(
      cov, [{ durationMin: 220, isKidsPlan: true }], 30, 30,
    );
    expect(r[0].sibValue).toBe(20); // 40min excedente × 30/60
    expect(r[0].sibUsedPackage).toBe(false);
  });

  it('múltiplos irmãos: distribui sobra do menor para o maior na ordem', () => {
    // pacote 3h = 180min, principal=60, sobra=120min para 2 irmãos de 60min cada
    const cov = calculateMultiPackageCoverage([pkg('p', 3)], 60, 30, 120);
    const r = distributeSiblingCoverageOverPackage(
      cov,
      [
        { durationMin: 60, isKidsPlan: false },
        { durationMin: 60, isKidsPlan: false },
      ],
      30,
      30,
    );
    expect(r[0].sibValue).toBe(0);
    expect(r[0].sibUsedPackage).toBe(true);
    expect(r[1].sibValue).toBe(0);
    expect(r[1].sibUsedPackage).toBe(true);
  });

  it('sobra parcial: primeiro irmão coberto, segundo paga', () => {
    // pacote 2h = 120min, principal=60, sobra=60min → cobre primeiro irmão completo
    const cov = calculateMultiPackageCoverage([pkg('p', 2)], 60, 30, 120);
    const r = distributeSiblingCoverageOverPackage(
      cov,
      [
        { durationMin: 60, isKidsPlan: false },
        { durationMin: 60, isKidsPlan: false },
      ],
      30,
      30,
    );
    expect(r[0].sibValue).toBe(0);
    expect(r[1].sibValue).toBe(30);
  });
});

describe('recalcDurationMinutes', () => {
  it('retorna 0 quando checkIn é undefined ou null', () => {
    expect(recalcDurationMinutes(undefined)).toBe(0);
    expect(recalcDurationMinutes(null)).toBe(0);
  });

  it('calcula minutos entre checkIn e now', () => {
    const checkIn = new Date('2026-05-26T10:00:00Z');
    const now = new Date('2026-05-26T10:30:00Z').getTime();
    expect(recalcDurationMinutes(checkIn, now)).toBe(30);
  });

  it('arredonda para cima (Math.ceil)', () => {
    const checkIn = new Date('2026-05-26T10:00:00Z');
    const now = new Date('2026-05-26T10:00:30Z').getTime();
    expect(recalcDurationMinutes(checkIn, now)).toBe(1);
  });

  it('aceita string de data ISO', () => {
    const now = new Date('2026-05-26T10:30:00Z').getTime();
    expect(recalcDurationMinutes('2026-05-26T10:00:00Z', now)).toBe(30);
  });

  it('nunca retorna negativo (relógio inconsistente)', () => {
    const checkIn = new Date('2026-05-26T11:00:00Z');
    const now = new Date('2026-05-26T10:00:00Z').getTime();
    expect(recalcDurationMinutes(checkIn, now)).toBe(0);
  });

  it('retorna 0 para data inválida', () => {
    expect(recalcDurationMinutes('texto-invalido')).toBe(0);
  });

  it('REGRESSÃO: bug de drift — calcula no momento do checkout, não no momento do load', () => {
    // Modal abriu às 10:00 (duration=60 capturada), checkout às 10:15 (deveria ser 75min)
    const checkIn = new Date('2026-05-26T09:00:00Z');
    const modalOpenTime = new Date('2026-05-26T10:00:00Z').getTime();
    const checkoutTime = new Date('2026-05-26T10:15:00Z').getTime();

    const staleDuration = recalcDurationMinutes(checkIn, modalOpenTime);
    const freshDuration = recalcDurationMinutes(checkIn, checkoutTime);

    expect(staleDuration).toBe(60);
    expect(freshDuration).toBe(75);
    expect(freshDuration).toBeGreaterThan(staleDuration);
  });
});
