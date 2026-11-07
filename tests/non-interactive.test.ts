import { describe, expect, test } from 'bun:test';
import type { SelectChoice } from '../src';
import {
  createPromptSession,
  createRenderer,
  INTERRUPTED_EXIT_CODE,
  NonInteractiveRenderer,
  PromptInterruptedError,
  PromptValidationError,
  USAGE_EXIT_CODE,
} from '../src';

const CHOICES: SelectChoice<'a' | 'b'>[] = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

/**
 * The frozen non-interactive contract (challenge C3): a session resolves from
 * (1) the injected answers map, (2) the default, (3) a validation error, and
 * only then (4) the TTY. `--no-interaction`/`--json` force (1)/(2) and never
 * read the TTY. These tests use no TTY at all, so any TTY read would hang.
 */
describe('non-interactive resolution order (challenge C3)', () => {
  test('a renderer built with interactive:false reports non-interactive and refuses to prompt', async () => {
    const renderer = createRenderer({ interactive: false });
    expect(renderer.interactive).toBe(false);
    const session = createPromptSession({ renderer });
    await expect(session.text({ message: 'Name' })).rejects.toBeInstanceOf(PromptValidationError);
  });

  test('(1) an injected answer wins over the default', async () => {
    const session = createPromptSession({
      renderer: new NonInteractiveRenderer(),
      answers: { Name: 'Ada' },
    });
    await expect(session.text({ message: 'Name', defaultValue: 'Grace' })).resolves.toBe('Ada');
  });

  test('(2) the default resolves when no answer is injected', async () => {
    const session = createPromptSession({ renderer: new NonInteractiveRenderer() });
    await expect(session.confirm({ message: 'Proceed?', defaultValue: true })).resolves.toBe(true);
  });

  test('(3) a required prompt with neither answer nor default fails with exit 2', async () => {
    const session = createPromptSession({ renderer: new NonInteractiveRenderer() });
    try {
      await session.text({ message: 'Name' });
      throw new Error('expected a validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(PromptValidationError);
      expect((error as PromptValidationError).exitCode).toBe(USAGE_EXIT_CODE);
    }
  });

  test('coerces injected answers to the prompt kind', async () => {
    const session = createPromptSession({
      renderer: new NonInteractiveRenderer(),
      answers: { Proceed: 'yes', Pick: 'b', Many: 'a, b' },
    });
    await expect(session.confirm({ message: 'Proceed' })).resolves.toBe(true);
    await expect(session.select({ message: 'Pick', choices: CHOICES })).resolves.toBe('b');
    await expect(session.multiselect({ message: 'Many', choices: CHOICES })).resolves.toEqual(['a', 'b']);
  });

  test('rejects an injected answer outside the choices', async () => {
    const session = createPromptSession({
      renderer: new NonInteractiveRenderer(),
      answers: { Pick: 'z' },
    });
    await expect(session.select({ message: 'Pick', choices: CHOICES })).rejects.toBeInstanceOf(PromptValidationError);
  });

  test('rejects an injected answer that fails the validator', async () => {
    const session = createPromptSession({
      renderer: new NonInteractiveRenderer(),
      answers: { Email: 'nope' },
    });
    await expect(
      session.text({ message: 'Email', validate: (value) => (value.includes('@') ? null : 'Invalid email') }),
    ).rejects.toBeInstanceOf(PromptValidationError);
  });

  test('an interrupt maps to exit 130', () => {
    expect(new PromptInterruptedError().exitCode).toBe(INTERRUPTED_EXIT_CODE);
  });
});
