/** The `confirm` prompt: a yes/no question. */
import type { ConfirmOptions, Prompt, Renderer } from './types';

/** Builds a `confirm` prompt. Resolves through a `Renderer`. */
export function confirm(options: ConfirmOptions): Prompt<boolean> {
  const prompt: Prompt<boolean> = {
    kind: 'confirm',
    message: options.message,
    defaultValue: options.defaultValue,
    run: (renderer: Renderer) => renderer.ask(prompt),
  };
  return prompt;
}
