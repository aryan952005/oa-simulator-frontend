import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { json, mockFetch, renderApp, stubApiBase } from '../test/helpers';

beforeEach(() => stubApiBase());

async function openLanding() {
  mockFetch(() => json(200, {}));
  renderApp('/');
  return screen.findByTestId('screen-S1');
}

describe('S1 Landing', () => {
  it('has a headline and the one-sentence description', async () => {
    const page = await openLanding();
    expect(within(page).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(page).toHaveTextContent(
      'Practise timed Python problems in rounds you build yourself, then read a report of how the round went.',
    );
  });

  it('shows the four steps in order', async () => {
    const page = await openLanding();
    const titles = within(page)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .slice(0, 4);
    expect(titles).toEqual(['Build a round', 'Start the timer', 'Solve and Run', 'Read your report']);
  });

  it('shows the four feature cards', async () => {
    const page = await openLanding();
    const titles = within(page)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .slice(4);
    expect(titles).toEqual([
      'Round builder',
      'Server-timed rounds',
      'Run on samples, Submit on all tests',
      'A report with insights',
    ]);
  });

  it('builds the numbers in the steps from the limits file', async () => {
    const page = await openLanding();
    expect(page).toHaveTextContent('Pick 1 to 5 questions by topic and difficulty, and set 5 to 180 minutes.');
  });

  it('has two buttons in the page: Create account to /register and Log in to /login', async () => {
    const page = await openLanding();
    expect(within(page).getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register');
    expect(within(page).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(within(page).getAllByRole('link')).toHaveLength(2);
  });

  it('has a footer with only a copyright line and the two links', async () => {
    await openLanding();
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} OA Simulator`);
    const links = within(footer).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Log in', '/login'],
      ['Create account', '/register'],
    ]);
  });

  it('does not show what the spec removes: statistics, runner claims, testimonials, extra footer pages', async () => {
    await openLanding();
    const text = document.body.textContent;
    expect(text).not.toMatch(/\d+\s*%/); // pass rate and other percentages
    expect(text).not.toMatch(/pass rate/i);
    expect(text).not.toMatch(/response time|execution speed/i);
    expect(text).not.toMatch(/python 3\.\d/i);
    expect(text).not.toMatch(/in-browser|zero setup/i);
    expect(text).not.toMatch(/testimonial|thousands|students love/i);
    expect(text).not.toMatch(/privacy|terms|faq|curriculum/i);
    expect(screen.queryByText('AC')).not.toBeInTheDocument();
  });
});
