import { describe, expect, it } from 'vitest';
import { formatBRL } from './currency';

describe('formatBRL', () => {
  it.each([
    [0, 'R$ 0,00'],
    [531, 'R$ 531,00'],
    [1234.5, 'R$ 1.234,50'],
    [0.1 + 0.2, 'R$ 0,30'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatBRL(input)).toBe(expected);
  });

  it('falls back to zero for non-finite values', () => {
    expect(formatBRL(NaN)).toBe('R$ 0,00');
    expect(formatBRL(Infinity)).toBe('R$ 0,00');
  });
});
