import { describe, expect, test } from 'bun:test';
import {
  atLeast,
  atMost,
  combine,
  email,
  firstError,
  integer,
  max,
  maxLength,
  min,
  minLength,
  oneOf,
  optional,
  pattern,
  required,
} from '../src/validate';

describe('validators', () => {
  test('required rejects blank values and accepts content', () => {
    expect(required()('   ')).toMatch(/required/i);
    expect(required()('x')).toBeNull();
  });

  test('length validators', () => {
    expect(minLength(3)('ab')).toMatch(/at least 3/);
    expect(minLength(3)('abc')).toBeNull();
    expect(maxLength(2)('abc')).toMatch(/at most 2/);
    expect(maxLength(2)('ab')).toBeNull();
  });

  test('pattern and email', () => {
    expect(pattern(/^\d+$/)('12a')).not.toBeNull();
    expect(pattern(/^\d+$/)('12')).toBeNull();
    expect(email()('a@b.co')).toBeNull();
    expect(email()('nope')).toMatch(/valid email/i);
  });

  test('oneOf', () => {
    expect(oneOf<string>(['a', 'b'])('c')).toMatch(/a, b/);
    expect(oneOf(['a', 'b'] as const)('a')).toBeNull();
  });

  test('numeric validators', () => {
    expect(integer()('3.5')).toMatch(/whole number/i);
    expect(integer()(' -12 ')).toBeNull();
    expect(min(5)(4)).toMatch(/at least 5/);
    expect(max(5)(6)).toMatch(/at most 5/);
    expect(min(5)(5)).toBeNull();
  });

  test('array validators', () => {
    expect(atLeast(2)(['a'])).toMatch(/at least 2/);
    expect(atMost(1)(['a', 'b'])).toMatch(/at most 1/);
    expect(atLeast(1)(['a'])).toBeNull();
  });

  test('combine returns the first failure and firstError exposes it', () => {
    const validate = combine(required(), minLength(3));
    expect(validate('')).toMatch(/required/i);
    expect(validate('ab')).toMatch(/at least 3/);
    expect(validate('abc')).toBeNull();
    expect(firstError('ab', [required(), minLength(3)])).toMatch(/at least 3/);
    expect(firstError('abc', [])).toBeNull();
  });

  test('optional lets blank through but validates content', () => {
    const validate = optional(email());
    expect(validate('')).toBeNull();
    expect(validate('nope')).toMatch(/valid email/i);
    expect(validate('a@b.co')).toBeNull();
  });
});
