/** The `text` prompt: a single free-form line of input. */
import type { Prompt, Renderer, TextOptions } from './types';

/** Builds a `text` prompt. Resolves through a `Renderer`. */
export function text(options: TextOptions): Prompt<string> {
  const prompt: Prompt<string> = {
    kind: 'text',
    message: options.message,
    defaultValue: options.defaultValue,
    validate: options.validate,
    run: (renderer: Renderer) => renderer.ask(prompt),
  };
  return prompt;
}
