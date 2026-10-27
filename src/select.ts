/** The `select` prompt: pick exactly one of a set of choices. */
import { setPromptMeta } from './renderer';
import type { Prompt, Renderer, SelectOptions } from './types';

/**
 * Builds a `select` prompt. The choices are attached to the prompt object as
 * rendering metadata (readable through `promptChoices`), so any `Renderer` —
 * including a custom one — can render the list.
 */
export function select<T extends string>(options: SelectOptions<T>): Prompt<T> {
  const prompt: Prompt<T> = {
    kind: 'select',
    message: options.message,
    defaultValue: options.defaultValue,
    run: (renderer: Renderer) => renderer.ask(prompt),
  };
  setPromptMeta(prompt, { choices: options.choices });
  return prompt;
}
