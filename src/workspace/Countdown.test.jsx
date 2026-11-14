import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClock, syncClock } from '../lib/clock';
import Countdown from './Countdown';

const NOW = new Date('2026-11-12T10:00:00.000Z');
const SEC = 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  resetClock();
});
afterEach(() => vi.useRealTimers());

const deadlineIn = (ms) => new Date(NOW.getTime() + ms).toISOString();
const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('Countdown', () => {
  it('shows the time left and updates once per second', async () => {
    render(<Countdown deadline={deadlineIn(65 * SEC)} onPreDeadline={() => {}} onZero={() => {}} />);
    expect(screen.getByRole('timer')).toHaveTextContent('01:05');
    await advance(1000);
    expect(screen.getByRole('timer')).toHaveTextContent('01:04');
    await advance(4000);
    expect(screen.getByRole('timer')).toHaveTextContent('01:00');
  });

  it('calls onPreDeadline once when 15 seconds are left, and not before', async () => {
    const onPreDeadline = vi.fn();
    render(<Countdown deadline={deadlineIn(20 * SEC)} onPreDeadline={onPreDeadline} onZero={() => {}} />);
    await advance(4000); // 16 s left
    expect(onPreDeadline).not.toHaveBeenCalled();
    await advance(1000); // 15 s left
    expect(onPreDeadline).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(onPreDeadline).toHaveBeenCalledTimes(1);
  });

  it('calls onZero once when the time is over, and keeps showing 00:00', async () => {
    const onZero = vi.fn();
    render(<Countdown deadline={deadlineIn(3 * SEC)} onPreDeadline={() => {}} onZero={onZero} />);
    await advance(2000);
    expect(onZero).not.toHaveBeenCalled();
    await advance(1000);
    expect(onZero).toHaveBeenCalledTimes(1);
    await advance(10000);
    expect(onZero).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
  });

  it('uses the server clock: a laptop clock that is 10 minutes ahead does not end the round early', async () => {
    // The laptop thinks it is 10 minutes later than the server does.
    vi.setSystemTime(new Date(NOW.getTime() + 10 * 60 * SEC));
    syncClock(NOW.toISOString());
    const onZero = vi.fn();
    render(<Countdown deadline={deadlineIn(5 * 60 * SEC)} onPreDeadline={() => {}} onZero={onZero} />);
    expect(screen.getByRole('timer')).toHaveTextContent('05:00');
    expect(onZero).not.toHaveBeenCalled();
  });

  it('is amber under 5 minutes and neutral above', async () => {
    render(<Countdown deadline={deadlineIn(5 * 60 * SEC + 2 * SEC)} onPreDeadline={() => {}} onZero={() => {}} />);
    expect(screen.getByRole('timer')).toHaveAttribute('data-warning', 'false');
    await advance(3000);
    expect(screen.getByRole('timer')).toHaveAttribute('data-warning', 'true');
  });

  it('stays at 00:00 once frozen, even if the clock is later corrected to an earlier time', async () => {
    const { rerender } = render(<Countdown deadline={deadlineIn(3 * SEC)} onPreDeadline={() => {}} onZero={() => {}} />);
    await advance(4000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    rerender(<Countdown deadline={deadlineIn(3 * SEC)} onPreDeadline={() => {}} onZero={() => {}} frozen />);
    syncClock(new Date(NOW.getTime() - 5 * 60 * SEC).toISOString()); // a later answer says the server clock is 5 minutes behind
    await advance(2000);
    expect(screen.getByRole('timer')).toHaveTextContent('00:00');
    expect(screen.getByRole('timer')).toHaveAttribute('data-warning', 'true');
  });

  it('uses digits that do not change width', () => {
    render(<Countdown deadline={deadlineIn(61 * SEC)} onPreDeadline={() => {}} onZero={() => {}} />);
    expect(screen.getByRole('timer')).toHaveClass('tabular-nums');
    expect(screen.getByRole('timer')).toHaveClass('font-label-code-lg'); // JetBrains Mono
  });
});
