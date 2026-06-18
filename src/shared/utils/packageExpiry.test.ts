import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPackageExpiryDate, isPackageExpired, isPackageUsable, PackagePlanLike } from './packageExpiry';
import { Package } from '../types';

const NOW = new Date('2026-06-18T12:00:00Z');

const plans: PackagePlanLike[] = [
  { name: 'Pacote 10h', hours: 10, price: 300, expiryDays: 30 },
  { name: 'Pacote 20h', hours: 20, price: 550, expiryDays: 60 },
];

function makePkg(overrides: Partial<Package>): Package {
  return {
    id: 'p1',
    customerId: 'c1',
    type: 'Pacote 10h',
    hours: 10,
    usedHours: 0,
    price: 300,
    active: true,
    sharedAcrossUnits: false,
    unitId: 'u1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as Package;
}

describe('getPackageExpiryDate', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('uses createdAt + expiryDays from the package itself', () => {
    const pkg = makePkg({ createdAt: new Date('2026-06-01T00:00:00Z'), expiryDays: 30 });
    const exp = getPackageExpiryDate(pkg);
    expect(exp?.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('falls back to plan expiryDays (matched by hours) when package has no expiryDays', () => {
    // Legacy package without expiryDays nor expiresAt — must still expire via plan match
    const pkg = makePkg({ createdAt: new Date('2026-01-01T00:00:00Z'), expiryDays: undefined, expiresAt: undefined });
    const exp = getPackageExpiryDate(pkg, plans);
    expect(exp?.toISOString().slice(0, 10)).toBe('2026-01-31'); // 10h plan = 30 days
  });

  it('returns null when no expiryDays, no matching plan and no expiresAt', () => {
    const pkg = makePkg({ hours: 7, expiryDays: undefined, expiresAt: undefined });
    expect(getPackageExpiryDate(pkg, plans)).toBeNull();
  });

  it('falls back to explicit expiresAt when no expiryDays and no plan match', () => {
    const pkg = makePkg({ hours: 7, expiryDays: undefined, expiresAt: new Date('2026-03-15T00:00:00Z') });
    expect(getPackageExpiryDate(pkg, plans)?.toISOString().slice(0, 10)).toBe('2026-03-15');
  });
});

describe('isPackageExpired / isPackageUsable', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('marks a legacy package (no expiryDays) as expired via plan fallback', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // created 2026-01-01, 10h plan = 30 days -> expired on 2026-01-31, well before NOW
    const pkg = makePkg({ createdAt: new Date('2026-01-01T00:00:00Z'), expiryDays: undefined, expiresAt: undefined });

    // Without plans the old behaviour treated it as "never expires" (the bug)
    expect(isPackageExpired(pkg)).toBe(false);
    expect(isPackageUsable(pkg)).toBe(true);

    // With plans it is correctly considered expired and not usable
    expect(isPackageExpired(pkg, plans)).toBe(true);
    expect(isPackageUsable(pkg, plans)).toBe(false);
  });

  it('keeps a still-valid package usable', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const pkg = makePkg({ createdAt: new Date('2026-06-10T00:00:00Z'), expiryDays: 30 });
    expect(isPackageExpired(pkg)).toBe(false);
    expect(isPackageUsable(pkg)).toBe(true);
  });

  it('is not usable when out of hours even if not expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const pkg = makePkg({ createdAt: new Date('2026-06-10T00:00:00Z'), expiryDays: 30, hours: 10, usedHours: 10 });
    expect(isPackageUsable(pkg)).toBe(false);
  });

  it('is not usable when inactive', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const pkg = makePkg({ createdAt: new Date('2026-06-10T00:00:00Z'), expiryDays: 30, active: false });
    expect(isPackageUsable(pkg)).toBe(false);
  });
});
