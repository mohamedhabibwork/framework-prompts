/** The `multiselect` prompt: pick zero or more of a set of choices. */
import { setPromptMeta } from './renderer';
import type { MultiSelectOptions, Prompt, Renderer } from './types';

/**
 * Builds a `multiselect` prompt. The choices are attached to the prompt object
 * as rendering metadata (readable through `promptChoices`); the `defaultValues`
 * become the prompt's `defaultValue`.
 */
export function multiselect<T extends string>(options: MultiSelectOptions<T>): Prompt<readonly T[]> {
  const prompt: Prompt<readonly T[]> = {
    kind: 'multiselect',
    message: options.message,
    defaultValue: options.defaultValues,
    run: (renderer: Renderer) => renderer.ask(prompt),
  };
  setPromptMeta(prompt, { choices: options.choices });
  return prompt;
}
