/**
 * Every interface and type of `@framework/prompts`.
 * Type-only: importing from this module never emits runtime code.
 *
 * The package separates **rendering** from **resolution** so it can never hang
 * a non-interactive run (`--no-interaction` / `--json`): a `PromptSession`
 * resolves each answer from an injected answers map, then the prompt default,
 * then a validator error, and only then the TTY renderer.
 */

/** A value a prompt can resolve to. */
export type PromptAnswer = string | boolean | number | readonly string[];

/** The prompt kinds this package renders. */
export type PromptKind = 'text' | 'confirm' | 'select' | 'multiselect' | 'password' | 'spinner';

/** Returns `null` when the value is valid, or a human-readable message otherwise. */
export type Validator<T> = (value: T) => string | null;

/** One selectable row of a `select`/`multiselect` prompt. */
export interface SelectChoice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export interface TextOptions {
  readonly message: string;
  readonly defaultValue?: string;
  readonly validate?: Validator<string>;
}

export interface ConfirmOptions {
  readonly message: string;
  readonly defaultValue?: boolean;
}

export interface SelectOptions<T extends string> {
  readonly message: string;
  readonly choices: readonly SelectChoice<T>[];
  readonly defaultValue?: T;
}

export interface MultiSelectOptions<T extends string> {
  readonly message: string;
  readonly choices: readonly SelectChoice<T>[];
  readonly defaultValues?: readonly T[];
}

export interface PasswordOptions {
  readonly message: string;
  readonly validate?: Validator<string>;
}

/** A single prompt. `run` resolves the answer through a `Renderer`. */
export interface Prompt<T extends PromptAnswer> {
  readonly kind: PromptKind;
  readonly message: string;
  readonly defaultValue?: T;
  readonly validate?: Validator<T>;
  run(renderer: Renderer): Promise<T>;
}

/** Controls a running spinner (start/update/succeed/fail/stop). */
export interface SpinnerControl {
  start(label: string): void;
  update(label: string): void;
  succeed(label?: string): void;
  fail(label?: string): void;
  stop(): void;
}

/**
 * Renders prompts. A non-interactive renderer never reads the TTY: it reads the
 * answers map or the default, and fails loudly when neither is available.
 */
export interface Renderer {
  readonly interactive: boolean;
  /** Resolves an answer; non-interactive renderers read the answers map or the default. */
  ask<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T>;
  readonly spinner: SpinnerControl;
}

/** The surface exposed on the CLI `CommandContext`. */
export interface PromptSession {
  text(options: TextOptions): Promise<string>;
  confirm(options: ConfirmOptions): Promise<boolean>;
  select<T extends string>(options: SelectOptions<T>): Promise<T>;
  multiselect<T extends string>(options: MultiSelectOptions<T>): Promise<readonly T[]>;
  password(options: PasswordOptions): Promise<string>;
  spinner(label: string): SpinnerControl;
  /** Injected answers (tests, `--answers`, scripted runs). */
  readonly answers?: Readonly<Record<string, PromptAnswer>>;
}
