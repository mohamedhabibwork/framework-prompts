import { describe, expect, test } from 'bun:test';
import type { Prompt, PromptAnswer, Renderer, SelectChoice, SpinnerControl } from '../src';
import { createPromptSession, NonInteractiveRenderer, PromptValidationError, promptChoices } from '../src';

/**
 * A fake interactive renderer. Tests never need a TTY: the interactive paths are
 * driven entirely through this injected `Renderer` (design §8.11).
 */
class FakeRenderer implements Renderer {
  readonly interactive = true;
  readonly seen: Prompt<PromptAnswer>[] = [];
  startCalls = 0;
  readonly spinner: SpinnerControl;
  private readonly script: PromptAnswer[];

  constructor(script: readonly PromptAnswer[] = []) {
    this.script = [...script];
    this.spinner = {
      start: () => {
        this.startCalls += 1;
      },
      update: () => {},
      succeed: () => {},
      fail: () => {},
      stop: () => {},
    };
  }

  async ask<T extends PromptAnswer>(prompt: Prompt<T>): Promise<T> {
    this.seen.push(prompt as unknown as Prompt<PromptAnswer>);
    const next = this.script.shift();
    if (next === undefined) throw new Error('FakeRenderer: no scripted answer');
    return next as T;
  }
}

const CHOICES: SelectChoice<'a' | 'b' | 'c'>[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
  { value: 'c', label: 'C' },
];

describe('prompt factories and session', () => {
  test('text resolves through the renderer and reports the prompt kind', async () => {
    const renderer = new FakeRenderer(['Ada']);
    const session = createPromptSession({ renderer });
    await expect(session.text({ message: 'Name' })).resolves.toBe('Ada');
    expect(renderer.seen[0]?.kind).toBe('text');
  });

  test('confirm, password, select and multiselect resolve through the renderer', async () => {
    const renderer = new FakeRenderer([true, 'secret', 'b', ['a', 'c']]);
    const session = createPromptSession({ renderer });
    await expect(session.confirm({ message: 'Proceed?' })).resolves.toBe(true);
    await expect(session.password({ message: 'Password' })).resolves.toBe('secret');
    await expect(session.select({ message: 'Pick', choices: CHOICES })).resolves.toBe('b');
    await expect(session.multiselect({ message: 'Many', choices: CHOICES })).resolves.toEqual(['a', 'c']);
  });

  test('select and multiselect carry their choices to the renderer', async () => {
    const renderer = new FakeRenderer(['a', ['b']]);
    const session = createPromptSession({ renderer });
    await session.select({ message: 'Pick', choices: CHOICES });
    await session.multiselect({ message: 'Many', choices: CHOICES });
    const [first, second] = renderer.seen;
    if (!first || !second) throw new Error('expected two prompts');
    expect(promptChoices(first).map((choice) => choice.value)).toEqual(['a', 'b', 'c']);
    expect(promptChoices(second).map((choice) => choice.value)).toEqual(['a', 'b', 'c']);
  });

  test('defaults resolve without touching the renderer', async () => {
    const renderer = new FakeRenderer([]);
    const session = createPromptSession({ renderer });
    await expect(session.text({ message: 'Name', defaultValue: 'Grace' })).resolves.toBe('Grace');
    await expect(session.confirm({ message: 'Proceed?', defaultValue: false })).resolves.toBe(false);
    await expect(session.select({ message: 'Pick', choices: CHOICES, defaultValue: 'c' })).resolves.toBe('c');
    expect(renderer.seen).toHaveLength(0);
  });

  test('the session re-validates the renderer answer', async () => {
    const renderer = new FakeRenderer(['nope']);
    const session = createPromptSession({ renderer });
    await expect(
      session.text({ message: 'Email', validate: (value) => (value.includes('@') ? null : 'Invalid email') }),
    ).rejects.toBeInstanceOf(PromptValidationError);
  });

  test('spinner starts through the renderer when interactive', () => {
    const renderer = new FakeRenderer();
    const session = createPromptSession({ renderer });
    const control = session.spinner('Working');
    expect(renderer.startCalls).toBe(1);
    expect(() => {
      control.update('Still working');
      control.succeed('Done');
    }).not.toThrow();
  });

  test('spinner is a no-op (never a crash) when the renderer is non-interactive', () => {
    const session = createPromptSession({ renderer: new NonInteractiveRenderer() });
    const control = session.spinner('Working');
    expect(() => {
      control.start('x');
      control.update('y');
      control.stop();
    }).not.toThrow();
  });
});
