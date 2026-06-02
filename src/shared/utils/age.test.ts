import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChildAge } from './age';

describe('getChildAge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    {
      name: 'ISO birth date string',
      child: { age: 0, birthDate: '2020-06-02T00:00:00Z' },
      expected: 6,
    },
    {
      name: 'Date instance',
      child: { age: 0, birthDate: new Date('2018-06-02T00:00:00Z') },
      expected: 8,
    },
    {
      name: 'Firestore-like timestamp',
      child: {
        age: 0,
        birthDate: {
          toDate: () => new Date('2016-06-02T00:00:00Z'),
        },
      },
      expected: 10,
    },
  ])('calculates age from $name', ({ child, expected }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    expect(getChildAge(child)).toBe(expected);
  });

  it.each([
    { name: 'missing birth date', child: { age: 7 } },
    { name: 'invalid birth date string', child: { age: 7, birthDate: 'not-a-date' } },
    { name: 'unsupported birth date shape', child: { age: 7, birthDate: { seconds: 0 } } },
  ])('falls back to the stored age for $name', ({ child }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T12:00:00Z'));

    expect(getChildAge(child)).toBe(7);
  });
});
