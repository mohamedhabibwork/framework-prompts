// Public API of @framework/prompts.
// Convention: every interface/type lives in `./types`; runtime values (the
// renderers, prompt factories, session, validators) stay in their own modules.
export { confirm } from './confirm';
export {
  ANSI,
  DEFAULT_SPINNER_FRAMES,
  INTERRUPTED_EXIT_CODE,
  SPINNER_INTERVAL_MS,
  USAGE_EXIT_CODE,
} from './constants';
export { multiselect } from './multiselect';
export { password } from './password';
export {
  createRenderer,
  NonInteractiveRenderer,
  PromptError,
  PromptInterruptedError,
  PromptValidationError,
  promptChoices,
  type RendererOptions,
  setPromptMeta,
  TtyRenderer,
  type TtyRendererOptions,
} from './renderer';
export { select } from './select';
export { createPromptSession, type PromptSessionOptions } from './session';
export { createSpinner, noopSpinner, type SpinnerOptions } from './spinner';
export { text } from './text';
export type {
  ConfirmOptions,
  MultiSelectOptions,
  PasswordOptions,
  Prompt,
  PromptAnswer,
  PromptKind,
  PromptSession,
  Renderer,
  SelectChoice,
  SelectOptions,
  SpinnerControl,
  TextOptions,
  Validator,
} from './types';
export {
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
} from './validate';
