/**
 * Renderers and prompt failures.
 *
 * Rendering is separated from resolution (challenge C3): a renderer only knows
 * how to *display* a prompt and read a raw answer, never whether an answer may
 * be read at all. The `PromptSession` owns the resolution order.
 *
 * Two renderers ship: `TtyRenderer` (ANSI + raw mode, with a `node:readline`
 * line-mode fallback when raw mode is unavailable) and `NonInteractiveRenderer`
 * (a Null Object that never reads the TTY and refuses to prompt).
 */
import { createInterface } from 'node:readline/promises';
import { ANSI, DEFAULT_SPINNER_FRAMES, INTERRUPTED_EXIT_CODE, SPINNER_INTERVAL_MS, USAGE_EXIT_CODE } from './constants';
import { createSpinner, noopSpinner } from './spinner';
import type { Prompt, PromptAnswer, Renderer, SelectChoice, SpinnerControl } from './types';

/** A prompts failure carrying the process exit code the CLI maps onto `CliError`. */
export class PromptError extends Error {
  constructor(
    readonly exitCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PromptError';
  }
}

/** Validation failed, or a required answer was missing (exit 2 = `EXIT.USAGE`). */
export class PromptValidationError extends PromptError {
  constructor(
    readonly prompt: string,
    message: string,
  ) {
    super(USAGE_EXIT_CODE, 'PROMPT_VALIDATION_FAILED', message);
    this.name = 'PromptValidationError';
  }
}

/** The prompt was interrupted (Ctrl-C); exit 130 = `EXIT.INTERRUPTED`. */
export class PromptInterruptedError extends PromptError {
  constructor(message = 'Interrupted') {
    super(INTERRUPTED_EXIT_CODE, 'PROMPT_INTERRUPTED', message);
    this.name = 'PromptInterruptedError';
  }
}

/** Kind-specific rendering data attached to a prompt object. */
interface PromptMeta {
  readonly choices?: readonly SelectChoice<string>[];
}

const PROMPT_META = new WeakMap<object, PromptMeta>();

/** Attaches kind-specific rendering data to a prompt (select/multiselect choices). */
export function setPromptMeta(prompt: object, meta: PromptMeta): void {
  PROMPT_META.set(prompt, meta);
}

/**
 * Reads the choices carried by a `select`/`multiselect` prompt (empty for other
 * kinds). Exposed so a custom `Renderer` can implement choice prompts.
 */
export function promptChoices(prompt: object): readonly SelectChoice<string>[] {
  return PROMPT_META.get(prompt)?.choices ?? [];
}

/** A renderer that never reads the TTY; used for `--no-interaction` / `--json`. */
export class NonInteractiveRenderer implements Renderer {
  readonly interactive = false;
  readonly spinner: SpinnerControl = noopSpinner();

  ask<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    return Promise.reject(
      new PromptValidationError(prompt.message, `Cannot prompt for "${prompt.message}" in non-interactive mode.`),
    );
  }
}

/** Options for `TtyRenderer`. */
export interface TtyRendererOptions {
  readonly input?: NodeJS.ReadStream;
  readonly output?: NodeJS.WriteStream;
  readonly frames?: readonly string[];
  readonly intervalMs?: number;
}

/**
 * The interactive renderer. Uses raw mode for arrow-key select/multiselect when
 * the input is a TTY, and falls back to `node:readline` line mode otherwise
 * (still functional, no arrow keys — documented in the design, assumption A7).
 */
export class TtyRenderer implements Renderer {
  readonly interactive = true;
  readonly spinner: SpinnerControl;
  private readonly input: NodeJS.ReadStream;
  private readonly output: NodeJS.WriteStream;

  constructor(options: TtyRendererOptions = {}) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stderr;
    this.spinner = createSpinner({
      output: (text) => {
        this.output.write(text);
      },
      frames: options.frames ?? DEFAULT_SPINNER_FRAMES,
      intervalMs: options.intervalMs ?? SPINNER_INTERVAL_MS,
    });
  }

  ask<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    switch (prompt.kind) {
      case 'text':
        return this.readText(prompt);
      case 'password':
        return this.readPassword(prompt);
      case 'confirm':
        return this.readConfirm(prompt);
      case 'select':
        return this.readSelect(prompt);
      case 'multiselect':
        return this.readMultiselect(prompt);
      default:
        return Promise.reject(new PromptValidationError(prompt.message, 'Spinner prompts are not asked.'));
    }
  }

  // -- text / password / confirm ---------------------------------------------

  private async readText<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    const hint = prompt.defaultValue !== undefined ? ` ${ANSI.dim}(${String(prompt.defaultValue)})${ANSI.reset}` : '';
    for (;;) {
      const raw = await this.question(`${ANSI.cyan}?${ANSI.reset} ${prompt.message}${hint} `);
      const value = raw.length > 0 ? raw : prompt.defaultValue !== undefined ? String(prompt.defaultValue) : '';
      // The prompt factory guarantees the runtime kind matches `T`; the cast is
      // sound and confined to the resolution/render engine.
      const message = prompt.validate ? prompt.validate(value as T) : null;
      if (message === null) return value as T;
      this.output.write(`${ANSI.red}${message}${ANSI.reset}\n`);
    }
  }

  private async readPassword<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    for (;;) {
      const value = await this.questionHidden(`${ANSI.cyan}?${ANSI.reset} ${prompt.message} `);
      const message = prompt.validate ? prompt.validate(value as T) : null;
      if (message === null) return value as T;
      this.output.write(`${ANSI.red}${message}${ANSI.reset}\n`);
    }
  }

  private async readConfirm<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    const suffix = prompt.defaultValue === true ? ' (Y/n)' : prompt.defaultValue === false ? ' (y/N)' : ' (y/n)';
    for (;;) {
      const raw = (await this.question(`${ANSI.cyan}?${ANSI.reset} ${prompt.message}${suffix} `)).toLowerCase();
      if (raw === '') {
        if (prompt.defaultValue === undefined) {
          this.output.write('Please answer yes or no.\n');
          continue;
        }
        return prompt.defaultValue as T;
      }
      if (['y', 'yes', 'true', '1'].includes(raw)) return true as T;
      if (['n', 'no', 'false', '0'].includes(raw)) return false as T;
      this.output.write('Please answer yes or no.\n');
    }
  }

  // -- select / multiselect ---------------------------------------------------

  private async readSelect<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    const choices = promptChoices(prompt);
    if (choices.length === 0) {
      throw new PromptValidationError(prompt.message, `Select prompt "${prompt.message}" has no choices.`);
    }
    const value = this.canRaw()
      ? await this.selectRaw(prompt.message, prompt.defaultValue, choices)
      : await this.selectLine(prompt.message, prompt.defaultValue, choices);
    return value as T;
  }

  private async readMultiselect<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    const choices = promptChoices(prompt);
    if (choices.length === 0) {
      throw new PromptValidationError(prompt.message, `Multiselect prompt "${prompt.message}" has no choices.`);
    }
    for (;;) {
      const values = this.canRaw()
        ? await this.multiselectRaw(prompt.message, prompt.defaultValue, choices)
        : await this.multiselectLine(prompt.message, prompt.defaultValue, choices);
      const message = prompt.validate ? prompt.validate(values as T) : null;
      if (message === null) return values as T;
      this.output.write(`${ANSI.red}${message}${ANSI.reset}\n`);
    }
  }

  private async selectRaw(
    message: string,
    defaultValue: PromptAnswer | undefined,
    choices: readonly SelectChoice<string>[],
  ): Promise<string> {
    const initial = choices.findIndex((choice) => choice.value === defaultValue);
    let index = initial >= 0 ? initial : 0;
    const wasRaw = this.input.isRaw === true;
    this.input.setRawMode?.(true);
    this.input.resume();
    this.output.write(ANSI.cursorHide);
    const render = () => {
      this.output.write(`${ANSI.cyan}?${ANSI.reset} ${message}\n`);
      choices.forEach((choice, position) => {
        const pointer = position === index ? `${ANSI.cyan}❯${ANSI.reset}` : ' ';
        const hint = choice.hint ? ` ${ANSI.dim}${choice.hint}${ANSI.reset}` : '';
        this.output.write(`${pointer} ${choice.label}${hint}\n`);
      });
    };
    render();
    try {
      for (;;) {
        const key = await this.readKey();
        if (key === '\u0003') throw new PromptInterruptedError();
        if (key === '\u001B[A') {
          index = (index - 1 + choices.length) % choices.length;
        } else if (key === '\u001B[B') {
          index = (index + 1) % choices.length;
        } else if (key === '\r' || key === '\n') {
          const choice = choices[index];
          if (choice) return choice.value;
          continue;
        } else {
          continue;
        }
        this.clearLines(choices.length + 1);
        render();
      }
    } finally {
      this.input.setRawMode?.(wasRaw);
      this.input.pause();
      this.output.write(ANSI.cursorShow);
    }
  }

  private async selectLine(
    message: string,
    defaultValue: PromptAnswer | undefined,
    choices: readonly SelectChoice<string>[],
  ): Promise<string> {
    this.output.write(`${ANSI.cyan}?${ANSI.reset} ${message}\n`);
    choices.forEach((choice, position) => {
      this.output.write(`  ${position + 1}) ${choice.label}\n`);
    });
    for (;;) {
      const answer = await this.question('> ');
      if (answer === '' && defaultValue !== undefined) return String(defaultValue);
      const byValue = choices.find((choice) => choice.value === answer);
      if (byValue) return byValue.value;
      const asIndex = Number.parseInt(answer, 10);
      const byIndex =
        Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= choices.length ? choices[asIndex - 1] : undefined;
      if (byIndex) return byIndex.value;
      this.output.write(`${ANSI.red}Enter a value or a number between 1 and ${choices.length}.${ANSI.reset}\n`);
    }
  }

  private async multiselectRaw(
    message: string,
    defaultValue: PromptAnswer | undefined,
    choices: readonly SelectChoice<string>[],
  ): Promise<readonly string[]> {
    const selected = new Set<string>(Array.isArray(defaultValue) ? defaultValue.map((value) => String(value)) : []);
    let index = 0;
    const wasRaw = this.input.isRaw === true;
    this.input.setRawMode?.(true);
    this.input.resume();
    this.output.write(ANSI.cursorHide);
    const render = () => {
      this.output.write(
        `${ANSI.cyan}?${ANSI.reset} ${message} ${ANSI.dim}(space to toggle, enter to confirm)${ANSI.reset}\n`,
      );
      choices.forEach((choice, position) => {
        const pointer = position === index ? `${ANSI.cyan}❯${ANSI.reset}` : ' ';
        const mark = selected.has(choice.value) ? `${ANSI.green}◉${ANSI.reset}` : '◯';
        this.output.write(`${pointer} ${mark} ${choice.label}\n`);
      });
    };
    render();
    try {
      for (;;) {
        const key = await this.readKey();
        if (key === '\u0003') throw new PromptInterruptedError();
        if (key === '\u001B[A') {
          index = (index - 1 + choices.length) % choices.length;
        } else if (key === '\u001B[B') {
          index = (index + 1) % choices.length;
        } else if (key === ' ') {
          const choice = choices[index];
          if (choice) {
            if (selected.has(choice.value)) selected.delete(choice.value);
            else selected.add(choice.value);
          }
        } else if (key === '\r' || key === '\n') {
          return choices.filter((choice) => selected.has(choice.value)).map((choice) => choice.value);
        } else {
          continue;
        }
        this.clearLines(choices.length + 1);
        render();
      }
    } finally {
      this.input.setRawMode?.(wasRaw);
      this.input.pause();
      this.output.write(ANSI.cursorShow);
    }
  }

  private async multiselectLine(
    message: string,
    defaultValue: PromptAnswer | undefined,
    choices: readonly SelectChoice<string>[],
  ): Promise<readonly string[]> {
    this.output.write(`${ANSI.cyan}?${ANSI.reset} ${message} ${ANSI.dim}(comma-separated)${ANSI.reset}\n`);
    choices.forEach((choice, position) => {
      this.output.write(`  ${position + 1}) ${choice.label}\n`);
    });
    for (;;) {
      const answer = await this.question('> ');
      if (answer === '') {
        if (Array.isArray(defaultValue)) return defaultValue.map((value) => String(value));
        if (defaultValue !== undefined) return [String(defaultValue)];
        this.output.write(`${ANSI.red}Select at least one option.${ANSI.reset}\n`);
        continue;
      }
      const parts = answer
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      const values: string[] = [];
      let invalid = false;
      for (const part of parts) {
        const byValue = choices.find((choice) => choice.value === part);
        if (byValue) {
          values.push(byValue.value);
          continue;
        }
        const asIndex = Number.parseInt(part, 10);
        const byIndex =
          Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= choices.length ? choices[asIndex - 1] : undefined;
        if (byIndex) values.push(byIndex.value);
        else invalid = true;
      }
      if (!invalid) return values;
      this.output.write(`${ANSI.red}Unknown option(s): ${parts.join(', ')}.${ANSI.reset}\n`);
    }
  }

  // -- primitives -------------------------------------------------------------

  private canRaw(): boolean {
    return this.input.isTTY === true && typeof this.input.setRawMode === 'function';
  }

  private async question(text: string): Promise<string> {
    const rl = createInterface({ input: this.input, output: this.output });
    try {
      return (await rl.question(text)).trim();
    } finally {
      rl.close();
    }
  }

  private async questionHidden(text: string): Promise<string> {
    if (!this.canRaw()) return this.question(text);
    this.output.write(text);
    const wasRaw = this.input.isRaw === true;
    this.input.setRawMode?.(true);
    this.input.resume();
    try {
      return await this.readMasked();
    } finally {
      this.input.setRawMode?.(wasRaw);
      this.input.pause();
      this.output.write('\n');
    }
  }

  /** Reads a single line of masked input, one character at a time. */
  private readMasked(): Promise<string> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      const onData = (chunk: Buffer) => {
        for (const char of chunk.toString('utf8')) {
          if (char === '\u0003') {
            cleanup();
            reject(new PromptInterruptedError());
            return;
          }
          if (char === '\r' || char === '\n') {
            cleanup();
            resolve(buffer);
            return;
          }
          if (char === '\u007F' || char === '\b') {
            buffer = buffer.slice(0, -1);
            continue;
          }
          buffer += char;
        }
      };
      const cleanup = () => {
        this.input.off('data', onData);
      };
      this.input.on('data', onData);
    });
  }

  /** Reads one key press (a raw-mode data chunk). */
  private readKey(): Promise<string> {
    return new Promise((resolve) => {
      const onData = (chunk: Buffer) => {
        this.input.off('data', onData);
        resolve(chunk.toString('utf8'));
      };
      this.input.on('data', onData);
    });
  }

  private clearLines(count: number): void {
    for (let index = 0; index < count; index++) this.output.write('\u001B[1A\u001B[2K');
  }
}

/** Options for `createRenderer`. */
export interface RendererOptions {
  /** When false the returned renderer never reads the TTY. */
  readonly interactive: boolean;
  readonly input?: NodeJS.ReadStream;
  readonly output?: NodeJS.WriteStream;
}

/** Builds the appropriate renderer for the invocation. */
export function createRenderer(options: RendererOptions): Renderer {
  if (!options.interactive) return new NonInteractiveRenderer();
  return new TtyRenderer({ input: options.input, output: options.output });
}
