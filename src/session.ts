/**
 * The `PromptSession`: owns the non-interactive-first resolution order (challenge
 * C3, a frozen contract).
 *
 * For every prompt the session resolves in this order:
 *   1. the injected `answers` map (validated, coerced by kind),
 *   2. the prompt's `defaultValue` (validated),
 *   3. the interactive renderer (only when `renderer.interactive` is true),
 *   4. otherwise a `PromptValidationError` (exit 2).
 *
 * Steps (1) and (2) never touch the TTY, so `--no-interaction` and `--json` can
 * force them and a CI run can never hang.
 */
import { confirm as confirmPrompt } from './confirm';
import { multiselect as multiselectPrompt } from './multiselect';
import { password as passwordPrompt } from './password';
import { PromptValidationError, promptChoices } from './renderer';
import { select as selectPrompt } from './select';
import { text as textPrompt } from './text';
import type {
  ConfirmOptions,
  MultiSelectOptions,
  PasswordOptions,
  Prompt,
  PromptAnswer,
  PromptSession,
  Renderer,
  SelectOptions,
  SpinnerControl,
  TextOptions,
} from './types';

/** Inputs for `createPromptSession`. */
export interface PromptSessionOptions {
  readonly renderer: Renderer;
  /** Injected answers keyed by prompt message (tests, `--answers`, scripted runs). */
  readonly answers?: Readonly<Record<string, PromptAnswer>>;
}

/**
 * Coerces an injected answer to the prompt's answer shape. Throws a
 * `PromptValidationError` (exit 2) when the raw value cannot fit the kind.
 */
function coerceAnswer<T extends PromptAnswer>(prompt: Prompt<T>, raw: PromptAnswer): PromptAnswer {
  switch (prompt.kind) {
    case 'text':
    case 'password':
      return typeof raw === 'string' ? raw : String(raw);
    case 'confirm': {
      if (typeof raw === 'boolean') return raw;
      const normalized = String(raw).trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
      throw new PromptValidationError(prompt.message, `Expected a yes/no answer for "${prompt.message}".`);
    }
    case 'select': {
      const choices = promptChoices(prompt);
      const value = typeof raw === 'string' ? raw : String(raw);
      if (choices.some((choice) => choice.value === value)) return value;
      throw new PromptValidationError(
        prompt.message,
        `"${value}" is not a valid choice for "${prompt.message}" (expected one of: ${choices
          .map((choice) => choice.value)
          .join(', ')}).`,
      );
    }
    case 'multiselect': {
      const choices = promptChoices(prompt);
      const values: string[] =
        typeof raw === 'string'
          ? raw
              .split(',')
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0)
          : Array.isArray(raw)
            ? raw.map((entry) => String(entry))
            : [String(raw)];
      const invalid = values.filter((value) => !choices.some((choice) => choice.value === value));
      if (invalid.length > 0) {
        throw new PromptValidationError(
          prompt.message,
          `Unknown option(s) for "${prompt.message}": ${invalid.join(', ')}.`,
        );
      }
      return values;
    }
    default:
      return raw;
  }
}

/** Creates a `PromptSession` over a `Renderer`, applying the frozen resolution order. */
export function createPromptSession(options: PromptSessionOptions): PromptSession {
  const { renderer, answers } = options;

  const validate = <T extends PromptAnswer>(prompt: Prompt<T>, value: T): T => {
    const message = prompt.validate ? prompt.validate(value) : null;
    if (message !== null) throw new PromptValidationError(prompt.message, message);
    return value;
  };

  const resolve = async <T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> => {
    const key = prompt.message;
    if (answers !== undefined && Object.hasOwn(answers, key)) {
      const raw = answers[key];
      if (raw !== undefined) {
        // `coerceAnswer` returns the concrete shape for the prompt's kind; the
        // factory guarantees kind <-> T, so the narrowing cast is sound.
        return validate(prompt, coerceAnswer(prompt, raw) as T);
      }
    }
    if (prompt.defaultValue !== undefined) {
      return validate(prompt, prompt.defaultValue);
    }
    if (renderer.interactive) {
      return validate(prompt, await renderer.ask(prompt));
    }
    throw new PromptValidationError(prompt.message, `Missing answer for required prompt "${key}".`);
  };

  return {
    answers,
    text: (textOptions: TextOptions) => resolve(textPrompt(textOptions)),
    confirm: (confirmOptions: ConfirmOptions) => resolve(confirmPrompt(confirmOptions)),
    select: <T extends string>(selectOptions: SelectOptions<T>) => resolve(selectPrompt(selectOptions)),
    multiselect: <T extends string>(multiOptions: MultiSelectOptions<T>) => resolve(multiselectPrompt(multiOptions)),
    password: (passwordOptions: PasswordOptions) => resolve(passwordPrompt(passwordOptions)),
    spinner: (label: string): SpinnerControl => {
      if (!renderer.interactive) return renderer.spinner;
      renderer.spinner.start(label);
      return renderer.spinner;
    },
  };
}
