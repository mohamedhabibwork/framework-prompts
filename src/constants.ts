/** Constants of `@framework/prompts`: ANSI escape codes and fixed defaults. */

/** ANSI SGR / control sequences used by the TTY renderer. */
export const ANSI = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  red: '\u001B[31m',
  green: '\u001B[32m',
  yellow: '\u001B[33m',
  cyan: '\u001B[36m',
  clearLine: '\u001B[2K',
  cursorHide: '\u001B[?25l',
  cursorShow: '\u001B[?25h',
} as const;

/** Frames for the built-in spinner, in order. */
export const DEFAULT_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/** Spinner animation interval, in milliseconds. */
export const SPINNER_INTERVAL_MS = 80;

/** Exit code emitted when a prompt is interrupted (Ctrl-C). Mirrors the CLI `EXIT.INTERRUPTED`. */
export const INTERRUPTED_EXIT_CODE = 130;

/** Exit code emitted when an answer fails validation or is missing. Mirrors the CLI `EXIT.USAGE`. */
export const USAGE_EXIT_CODE = 2;
