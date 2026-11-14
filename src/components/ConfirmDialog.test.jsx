import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog';

function Harness({ onConfirm = () => {}, busy = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Other</button>
      {open && (
        <ConfirmDialog title="Delete this round?" message="This cannot be undone." confirmLabel="Delete" busy={busy} onConfirm={onConfirm} onCancel={() => setOpen(false)} />
      )}
    </>
  );
}

describe('ConfirmDialog keyboard and focus', () => {
  it('is a labelled modal dialog and puts focus on Cancel when it opens', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this round?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Tab and Shift+Tab stay inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab(); // past the last button: back to the first, not out to the page
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true }); // before the first: to the last
    expect(confirm).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Other' })).not.toHaveFocus();
  });

  it('Escape closes it and focus goes back to the button that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('Cancel closes it and returns focus too', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(opener).toHaveFocus();
  });

  it('Enter on the focused Cancel button cancels, and Enter on Delete confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('while busy, Escape does nothing and focus does not leave the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness busy />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole('dialog')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Other' })).not.toHaveFocus();
  });

  it('a new onCancel from a re-render does not pull focus back to Cancel', async () => {
    const user = userEvent.setup();
    function Rerender() {
      const [count, setCount] = useState(0);
      return (
        <>
          <ConfirmDialog title="T" message="M" confirmLabel="Go" onConfirm={() => setCount(count + 1)} onCancel={() => {}} />
          <output>{count}</output>
        </>
      );
    }
    render(<Rerender />);
    await user.tab(); // Cancel -> Go
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus();
    await user.keyboard('{Enter}'); // re-renders with a new onCancel
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus();
  });
});
