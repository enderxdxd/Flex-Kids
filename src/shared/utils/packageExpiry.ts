import { Package } from '../types';

/**
 * Plano configurável (subset usado para resolver validade por horas).
 */
export interface PackagePlanLike {
  name?: string;
  hours: number;
  price?: number;
  expiryDays: number;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Calcula a data de expiração de um pacote.
 *
 * Prioridade (mesma lógica em todas as telas):
 *  1. createdAt + expiryDays do próprio pacote
 *  2. createdAt + expiryDays do plano correspondente (match por horas) — fallback
 *     para pacotes legados/importados que não gravaram expiryDays
 *  3. expiresAt explícito
 *  4. null (sem informação de validade)
 */
export function getPackageExpiryDate(pkg: Package, plans?: PackagePlanLike[]): Date | null {
  const createdAt = toDate(pkg.createdAt);

  let days = pkg.expiryDays;
  if ((!days || days <= 0) && plans && plans.length > 0) {
    const matchedPlan = plans.find(p => p.hours === pkg.hours);
    days = matchedPlan?.expiryDays;
  }

  if (days && days > 0 && createdAt) {
    const expiry = new Date(createdAt);
    expiry.setDate(expiry.getDate() + days);
    expiry.setHours(23, 59, 59, 999);
    return expiry;
  }

  // Fallback: expiresAt explícito (pacotes legados sem expiryDays)
  const explicitExpiry = toDate(pkg.expiresAt);
  if (explicitExpiry) return explicitExpiry;

  return null;
}

/** Pacote expirado (tem data de validade e ela já passou). */
export function isPackageExpired(pkg: Package, plans?: PackagePlanLike[]): boolean {
  const expiry = getPackageExpiryDate(pkg, plans);
  return !!expiry && expiry < new Date();
}

/** Pacote utilizável: ativo, com horas restantes e dentro da validade. */
export function isPackageUsable(pkg: Package, plans?: PackagePlanLike[]): boolean {
  const expiry = getPackageExpiryDate(pkg, plans);
  return pkg.active && pkg.usedHours < pkg.hours && (!expiry || expiry >= new Date());
}
