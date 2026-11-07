/**
 * Spinner controls. The non-interactive control is a Null Object: every method
 * is a no-op so a non-interactive run can call `start`/`succeed` without crashing
 * and without touching the TTY (design §1.4).
 */
import { ANSI, DEFAULT_SPINNER_FRAMES, SPINNER_INTERVAL_MS } from './constants';
import type { SpinnerControl } from './types';

/** Options for `createSpinner`. */
export interface SpinnerOptions {
  /** Sink for the animation frames (defaults to `process.stderr`). */
  readonly output?: (text: string) => void;
  /** Animation frames, cycled in order. */
  readonly frames?: readonly string[];
  /** Frame interval in milliseconds. */
  readonly intervalMs?: number;
}

/** A spinner that does nothing; used by non-interactive renderers. */
export function noopSpinner(): SpinnerControl {
  return {
    start: () => {},
    update: () => {},
    succeed: () => {},
    fail: () => {},
    stop: () => {},
  };
}

/** A TTY spinner that animates on the output stream; it never reads the TTY. */
export function createSpinner(options: SpinnerOptions = {}): SpinnerControl {
  const frames = options.frames ?? DEFAULT_SPINNER_FRAMES;
  const intervalMs = options.intervalMs ?? SPINNER_INTERVAL_MS;
  const write: (text: string) => void =
    options.output ??
    ((text) => {
      process.stderr.write(text);
    });
  let timer: ReturnType<typeof setInterval> | undefined;
  let label = '';
  let frame = 0;

  const clear = () => {
    write(`${ANSI.clearLine}\r`);
  };
  const stopTimer = () => {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  return {
    start(next: string) {
      label = next;
      stopTimer();
      write(ANSI.cursorHide);
      timer = setInterval(() => {
        const glyph = frames[frame % frames.length] ?? frames[0] ?? '-';
        frame += 1;
        write(`${ANSI.clearLine}\r${ANSI.cyan}${glyph}${ANSI.reset} ${label}`);
      }, intervalMs);
    },
    update(next: string) {
      label = next;
    },
    succeed(next?: string) {
      stopTimer();
      clear();
      write(`${ANSI.green}✔${ANSI.reset} ${next ?? label}\n${ANSI.cursorShow}`);
    },
    fail(next?: string) {
      stopTimer();
      clear();
      write(`${ANSI.red}✖${ANSI.reset} ${next ?? label}\n${ANSI.cursorShow}`);
    },
    stop() {
      stopTimer();
      clear();
      write(ANSI.cursorShow);
    },
  };
}
