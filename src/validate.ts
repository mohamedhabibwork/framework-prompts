/**
 * Validators and combinators for `@framework/prompts`.
 *
 * A `Validator<T>` is a pure function returning `null` when the value is valid
 * or a human-readable message otherwise (design §3). Validators never throw and
 * never touch the TTY, so they are safe to run on injected answers, defaults and
 * renderer output alike.
 */
import type { Validator } from './types';

/** Returns the first non-`null` message from a validator chain (`null` when all pass). */
export function firstError<T>(value: T, validators: readonly Validator<T>[]): string | null {
  for (const validate of validators) {
    const message = validate(value);
    if (message !== null) return message;
  }
  return null;
}

/** Combines validators; the first failing one wins. An empty chain is always valid. */
export function combine<T>(...validators: readonly Validator<T>[]): Validator<T> {
  return (value) => firstError(value, validators);
}

/** Rejects blank (whitespace-only) strings. */
export function required(message = 'A value is required.'): Validator<string> {
  return (value) => (value.trim().length === 0 ? message : null);
}

/** Requires at least `min` characters. */
export function minLength(min: number, message?: string): Validator<string> {
  return (value) => (value.length < min ? (message ?? `Must be at least ${min} characters.`) : null);
}

/** Requires at most `max` characters. */
export function maxLength(max: number, message?: string): Validator<string> {
  return (value) => (value.length > max ? (message ?? `Must be at most ${max} characters.`) : null);
}

/** Requires the value to match a regular expression. */
export function pattern(expression: RegExp, message = 'The value has an invalid format.'): Validator<string> {
  return (value) => (expression.test(value) ? null : message);
}

/** Requires a plausible email address (intentionally permissive). */
export function email(message = 'Enter a valid email address.'): Validator<string> {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

/** Requires the value to be one of `values`. */
export function oneOf<T extends string>(values: readonly T[], message?: string): Validator<T> {
  return (value) => (values.includes(value) ? null : (message ?? `Must be one of: ${values.join(', ')}.`));
}

/** Requires a whole number written as a string (e.g. a `text` prompt). */
export function integer(message = 'Enter a whole number.'): Validator<string> {
  return (value) => (/^[+-]?\d+$/.test(value.trim()) ? null : message);
}

/** Requires a numeric value `>= min`. */
export function min(min: number, message?: string): Validator<number> {
  return (value) => (value < min ? (message ?? `Must be at least ${min}.`) : null);
}

/** Requires a numeric value `<= max`. */
export function max(max: number, message?: string): Validator<number> {
  return (value) => (value > max ? (message ?? `Must be at most ${max}.`) : null);
}

/** Requires at least `min` selected values. */
export function atLeast(min: number, message?: string): Validator<readonly string[]> {
  return (value) => (value.length < min ? (message ?? `Select at least ${min} option(s).`) : null);
}

/** Requires at most `max` selected values. */
export function atMost(max: number, message?: string): Validator<readonly string[]> {
  return (value) => (value.length > max ? (message ?? `Select at most ${max} option(s).`) : null);
}

/** Runs `validate` only when the string is non-empty; blank values pass through. */
export function optional(validate: Validator<string>): Validator<string> {
  return (value) => (value.trim().length === 0 ? null : validate(value));
}
