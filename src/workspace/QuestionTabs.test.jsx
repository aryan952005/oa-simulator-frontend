import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuestionTabs from './QuestionTabs';

const SLOTS = [
  { index: 1, topic: 'arrays', difficulty: 'easy', opened: true, solved: false, runCount: 0, submitCount: 0 },
  { index: 2, topic: 'strings', difficulty: 'medium', opened: false, solved: false, runCount: 0, submitCount: 0 },
  { index: 3, topic: 'math', difficulty: 'hard', opened: false, solved: false, runCount: 0, submitCount: 0 },
];
const tab = (n) => screen.getByRole('tab', { name: new RegExp(`^Q${n} `) });

function setup(props = {}) {
  const onSelect = vi.fn();
  render(<QuestionTabs slots={SLOTS} selected={1} onSelect={onSelect} {...props} />);
  return { onSelect, user: userEvent.setup() };
}

describe('QuestionTabs keyboard use', () => {
  it('every tab can be reached with Tab and the selected one is marked', async () => {
    const { user } = setup();
    await user.tab();
    expect(tab(1)).toHaveFocus();
    await user.tab();
    expect(tab(2)).toHaveFocus();
    expect(tab(1)).toHaveAttribute('aria-selected', 'true');
    expect(tab(2)).toHaveAttribute('aria-selected', 'false');
  });

  it('the arrow keys move focus along the tabs and wrap around, without selecting anything', async () => {
    const { user, onSelect } = setup();
    tab(1).focus();
    await user.keyboard('{ArrowRight}');
    expect(tab(2)).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(tab(1)).toHaveFocus(); // wrapped past the last one
    await user.keyboard('{ArrowLeft}');
    expect(tab(3)).toHaveFocus(); // wrapped back
    expect(onSelect).not.toHaveBeenCalled(); // selecting would open a question and start its clock
  });

  it('Home and End go to the first and last tab', async () => {
    const { user, onSelect } = setup();
    tab(2).focus();
    await user.keyboard('{End}');
    expect(tab(3)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tab(1)).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Enter and Space choose the focused tab', async () => {
    const { user, onSelect } = setup();
    tab(1).focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith(2);
    await user.keyboard('{ArrowRight} ');
    expect(onSelect).toHaveBeenLastCalledWith(3);
  });

  it('other keys do nothing', async () => {
    const { user, onSelect } = setup();
    tab(1).focus();
    await user.keyboard('a{ArrowDown}');
    expect(tab(1)).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('while disabled no tab takes focus from the arrows', async () => {
    const { user } = setup({ disabled: true });
    expect(tab(1)).toBeDisabled();
    await user.keyboard('{ArrowRight}');
    expect(document.body).toHaveFocus();
  });
});
