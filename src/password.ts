/** The `password` prompt: masked input that is never echoed. */
import type { PasswordOptions, Prompt, Renderer } from './types';

/** Builds a `password` prompt. Resolves through a `Renderer`. */
export function password(options: PasswordOptions): Prompt<string> {
  const prompt: Prompt<string> = {
    kind: 'password',
    message: options.message,
    validate: options.validate,
    run: (renderer: Renderer) => renderer.ask(prompt),
  };
  return prompt;
}
