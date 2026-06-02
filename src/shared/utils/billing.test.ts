import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_DISCOUNT_RATIO,
  KIDS_PLAN_FREE_MINUTES,
  calculateKidsPlanCoverage,
  calculateMultiPackageCoverage,
  calculatePrincipalValue,
  calculateSiblingAvulsoValue,
  distributeSiblingCoverageOverPackage,
  recalcDurationMinutes,
} from './billing';

const pkg = (id: string, hours: number, usedHours: number = 0) => ({
  id,
  type: `${hours}h`,
  hours,
  usedHours,
});

describe('calculateKidsPlanCoverage', () => {
  it('keeps the standard free allowance at 180 minutes', () => {
    expect(KIDS_PLAN_FREE_MINUTES).toBe(180);
  });

  it.each([
    {
      name: 'zero duration',
      durationMin: 0,
      expected: {
        coveredMin: 0,
        excessMin: 0,
        billableExcessMin: 0,
        isFullyCovered: true,
        isPartial: false,
      },
    },
    {
      name: 'negative duration',
      durationMin: -10,
      expected: {
        coveredMin: 0,
        excessMin: 0,
        billableExcessMin: 0,
        isFullyCovered: true,
        isPartial: false,
      },
    },
    {
      name: 'under free allowance',
      durationMin: 120,
      expected: {
        coveredMin: 120,
        excessMin: 0,
        billableExcessMin: 0,
        isFullyCovered: true,
        isPartial: false,
      },
    },
    {
      name: 'exactly free allowance',
      durationMin: 180,
      expected: {
        coveredMin: 180,
        excessMin: 0,
        billableExcessMin: 0,
        isFullyCovered: true,
        isPartial: false,
      },
    },
    {
      name: 'small excess uses minimum billing time',
      durationMin: 185,
      expected: {
        coveredMin: 180,
        excessMin: 5,
        billableExcessMin: 30,
        isFullyCovered: false,
        isPartial: true,
      },
    },
    {
      name: 'large excess bills actual excess',
      durationMin: 240,
      expected: {
        coveredMin: 180,
        excessMin: 60,
        billableExcessMin: 60,
        isFullyCovered: false,
        isPartial: true,
      },
    },
  ])('$name', ({ durationMin, expected }) => {
    expect(calculateKidsPlanCoverage(durationMin, 30)).toEqual(expected);
  });

  it('accepts a custom free allowance', () => {
    expect(calculateKidsPlanCoverage(95, 30, 90)).toMatchObject({
      coveredMin: 90,
      excessMin: 5,
      billableExcessMin: 30,
    });
  });
});

describe('calculateMultiPackageCoverage', () => {
  it('uses the minimum time before applying package coverage', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p1', 10)], 10, 30);

    expect(coverage).toMatchObject({
      principalBillable: 30,
      totalBillableMinutes: 30,
      totalCoveredMin: 30,
      excessMin: 0,
      billableExcessMin: 0,
      isFullyCovered: true,
      isPartial: false,
      hasPackages: true,
    });
    expect(coverage.breakdown).toEqual([
      { pkg: pkg('p1', 10), coveredMin: 30 },
    ]);
  });

  it('keeps the 10h package regression at a half-hour deduction', () => {
    const coverage = calculateMultiPackageCoverage([pkg('10h', 10)], 30, 30);

    expect(coverage.isFullyCovered).toBe(true);
    expect(coverage.totalCoveredMin).toBe(30);
    expect(coverage.breakdown[0].coveredMin / 60).toBe(0.5);
  });

  it('sorts by remaining balance and does not mutate the input array', () => {
    const input = [pkg('large', 10), pkg('small', 1), pkg('medium', 5, 4)];
    const originalOrder = input.map((item) => item.id);

    const coverage = calculateMultiPackageCoverage(input, 120, 30);

    expect(input.map((item) => item.id)).toEqual(originalOrder);
    expect(coverage.breakdown.map((item) => item.pkg.id)).toEqual([
      'small',
      'medium',
    ]);
    expect(coverage.breakdown.map((item) => item.coveredMin)).toEqual([60, 60]);
  });

  it('ignores exhausted and overused packages', () => {
    const coverage = calculateMultiPackageCoverage(
      [pkg('exhausted', 10, 10), pkg('overused', 1, 2), pkg('available', 2)],
      60,
      30,
    );

    expect(coverage.hasPackages).toBe(true);
    expect(coverage.breakdown).toHaveLength(1);
    expect(coverage.breakdown[0].pkg.id).toBe('available');
  });

  it('reports no coverage when no package has remaining balance', () => {
    const coverage = calculateMultiPackageCoverage([pkg('spent', 1, 1)], 60, 30);

    expect(coverage).toMatchObject({
      hasPackages: false,
      totalCoveredMin: 0,
      excessMin: 60,
      billableExcessMin: 60,
      isFullyCovered: false,
      isPartial: false,
    });
    expect(coverage.breakdown).toEqual([]);
  });

  it('includes sibling extra minutes in the package coverage target', () => {
    const coverage = calculateMultiPackageCoverage([pkg('family', 2)], 60, 30, 60);

    expect(coverage.totalBillableMinutes).toBe(120);
    expect(coverage.totalCoveredMin).toBe(120);
    expect(coverage.isFullyCovered).toBe(true);
  });

  it('applies minimum billing time to a small package excess', () => {
    const coverage = calculateMultiPackageCoverage([pkg('almost-enough', 1, 0.75)], 30, 30);

    expect(coverage).toMatchObject({
      totalCoveredMin: 15,
      excessMin: 15,
      billableExcessMin: 30,
      isPartial: true,
      isFullyCovered: false,
    });
  });

  it('bills the actual excess when it is greater than the minimum', () => {
    const coverage = calculateMultiPackageCoverage([pkg('short', 1, 0.5)], 120, 30);

    expect(coverage).toMatchObject({
      totalCoveredMin: 30,
      excessMin: 90,
      billableExcessMin: 90,
      isPartial: true,
    });
  });
});

describe('calculatePrincipalValue', () => {
  it.each([
    {
      name: 'avulso bills the full duration',
      durationMin: 60,
      minimumTime: 30,
      hourlyRate: 30,
      employeeDiscount: false,
      expected: 30,
    },
    {
      name: 'avulso applies minimum time',
      durationMin: 10,
      minimumTime: 30,
      hourlyRate: 30,
      employeeDiscount: false,
      expected: 15,
    },
    {
      name: 'avulso applies employee discount',
      durationMin: 60,
      minimumTime: 30,
      hourlyRate: 30,
      employeeDiscount: true,
      expected: 30 * EMPLOYEE_DISCOUNT_RATIO,
    },
    {
      name: 'rounds to two decimals',
      durationMin: 50,
      minimumTime: 30,
      hourlyRate: 19.99,
      employeeDiscount: false,
      expected: 16.66,
    },
  ])('$name', ({ durationMin, minimumTime, hourlyRate, employeeDiscount, expected }) => {
    expect(calculatePrincipalValue({
      isKidsPlan: false,
      usePackages: false,
      durationMin,
      minimumTime,
      hourlyRate,
      employeeDiscount,
    })).toBe(expected);
  });

  it('returns zero when a package fully covers the principal visit', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 10)], 60, 30);

    expect(calculatePrincipalValue({
      isKidsPlan: false,
      usePackages: true,
      durationMin: 60,
      minimumTime: 30,
      hourlyRate: 30,
      multiCoverage: coverage,
    })).toBe(0);
  });

  it('charges only the uncovered principal portion for partial package coverage', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 1, 0.5)], 90, 30);

    expect(calculatePrincipalValue({
      isKidsPlan: false,
      usePackages: true,
      durationMin: 90,
      minimumTime: 30,
      hourlyRate: 30,
      multiCoverage: coverage,
    })).toBe(30);
  });

  it('keeps the 30-minute 10h package regression free for the principal visit', () => {
    const coverage = calculateMultiPackageCoverage([pkg('10h', 10)], 30, 30);

    expect(calculatePrincipalValue({
      isKidsPlan: false,
      usePackages: true,
      durationMin: 30,
      minimumTime: 30,
      hourlyRate: 30,
      multiCoverage: coverage,
    })).toBe(0);
  });

  it('charges only Kids Plan excess', () => {
    const coverage = calculateKidsPlanCoverage(220, 30);

    expect(calculatePrincipalValue({
      isKidsPlan: true,
      usePackages: false,
      durationMin: 220,
      minimumTime: 30,
      hourlyRate: 30,
      kidsCoverage: coverage,
    })).toBe(20);
  });

  it('prioritizes Kids Plan coverage over package coverage when both are passed', () => {
    const kidsCoverage = calculateKidsPlanCoverage(120, 30);
    const multiCoverage = calculateMultiPackageCoverage([pkg('p', 1, 1)], 120, 30);

    expect(calculatePrincipalValue({
      isKidsPlan: true,
      usePackages: true,
      durationMin: 120,
      minimumTime: 30,
      hourlyRate: 30,
      kidsCoverage,
      multiCoverage,
    })).toBe(0);
  });
});

describe('calculateSiblingAvulsoValue', () => {
  it.each([
    { name: 'full hour', durationMin: 60, expected: 30 },
    { name: 'minimum time', durationMin: 5, expected: 15 },
    { name: 'rounded cents', durationMin: 50, hourlyRate: 19.99, expected: 16.66 },
  ])('charges avulso for $name', ({ durationMin, hourlyRate = 30, expected }) => {
    expect(calculateSiblingAvulsoValue(durationMin, 30, hourlyRate)).toBe(expected);
  });

  it('applies employee discount', () => {
    expect(calculateSiblingAvulsoValue(60, 30, 30, true)).toBe(15);
  });
});

describe('distributeSiblingCoverageOverPackage', () => {
  it('fully covers siblings while package balance remains after the principal visit', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 3)], 60, 30, 120);

    expect(distributeSiblingCoverageOverPackage(
      coverage,
      [
        { durationMin: 60, isKidsPlan: false },
        { durationMin: 60, isKidsPlan: false },
      ],
      30,
      30,
    )).toEqual([
      { sibValue: 0, sibUsedPackage: true },
      { sibValue: 0, sibUsedPackage: true },
    ]);
  });

  it('charges avulso when the package only covers the principal visit', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 1)], 60, 30, 60);

    expect(distributeSiblingCoverageOverPackage(
      coverage,
      [{ durationMin: 60, isKidsPlan: false }],
      30,
      30,
    )).toEqual([{ sibValue: 30, sibUsedPackage: false }]);
  });

  it('charges only the uncovered portion when a sibling is partially covered', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 1.5)], 60, 30, 60);

    expect(distributeSiblingCoverageOverPackage(
      coverage,
      [{ durationMin: 60, isKidsPlan: false }],
      30,
      30,
    )).toEqual([{ sibValue: 15, sibUsedPackage: false }]);
  });

  it('applies minimum time to a small uncovered sibling portion', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 1.5)], 60, 30, 40);

    expect(distributeSiblingCoverageOverPackage(
      coverage,
      [{ durationMin: 40, isKidsPlan: false }],
      30,
      30,
    )).toEqual([{ sibValue: 15, sibUsedPackage: false }]);
  });

  it('applies employee discount to uncovered sibling charges', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 1)], 60, 30, 60);

    expect(distributeSiblingCoverageOverPackage(
      coverage,
      [{ durationMin: 60, isKidsPlan: false }],
      30,
      30,
      true,
    )).toEqual([{ sibValue: 15, sibUsedPackage: false }]);
  });

  it('keeps Kids Plan siblings separate from package balance', () => {
    const coverage = calculateMultiPackageCoverage([pkg('p', 2)], 60, 30);

    expect(distributeSiblingCoverageOverPackage(
      coverage,
      [{ durationMin: 220, isKidsPlan: true }],
      30,
      30,
    )).toEqual([{ sibValue: 20, sibUsedPackage: false }]);
  });
});

describe('recalcDurationMinutes', () => {
  it.each([
    { name: 'undefined check-in', checkIn: undefined },
    { name: 'null check-in', checkIn: null },
    { name: 'invalid date string', checkIn: 'invalid-date' },
  ])('returns zero for $name', ({ checkIn }) => {
    expect(recalcDurationMinutes(checkIn, Date.UTC(2026, 4, 26, 10, 0, 0))).toBe(0);
  });

  it('accepts Date and ISO string check-ins', () => {
    const now = new Date('2026-05-26T10:30:00Z').getTime();

    expect(recalcDurationMinutes(new Date('2026-05-26T10:00:00Z'), now)).toBe(30);
    expect(recalcDurationMinutes('2026-05-26T10:00:00Z', now)).toBe(30);
  });

  it('rounds sub-minute stays up to one minute', () => {
    const now = new Date('2026-05-26T10:00:30Z').getTime();

    expect(recalcDurationMinutes(new Date('2026-05-26T10:00:00Z'), now)).toBe(1);
  });

  it('returns zero when check-in equals now', () => {
    const now = new Date('2026-05-26T10:00:00Z').getTime();

    expect(recalcDurationMinutes(new Date('2026-05-26T10:00:00Z'), now)).toBe(0);
  });

  it('never returns negative duration when the clock is inconsistent', () => {
    const now = new Date('2026-05-26T10:00:00Z').getTime();

    expect(recalcDurationMinutes(new Date('2026-05-26T11:00:00Z'), now)).toBe(0);
  });

  it('recalculates from checkout time instead of a stale modal-open duration', () => {
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
