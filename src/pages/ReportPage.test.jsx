// S10 Report, checked against reports the real backend produced (src/test/fixtures/real-report-responses.json)
// and against variations of them.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDateTime } from '../lib/format';
import real from '../test/fixtures/real-report-responses.json';
import { apiError, callsTo, json, mockApi, renderApp, roundSummary, storeSession, stubApiBase } from '../test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession();
});

const location = () => screen.getByTestId('location').textContent;

const SCENARIOS = ['noSubmissions', 'excellent', 'strong', 'struggle', 'triage', 'failures', 'hiddenAndRisky', 'hardExcellent'];
const saved = (name) => ({ round: structuredClone(real[name].round.body), report: structuredClone(real[name].report.body) });

// Opens the report of a real round. `edit(report)` changes the report before the page gets it.
function openReport(name, { edit, extra = [], round: roundEdit } = {}) {
  const { round, report } = saved(name);
  if (roundEdit) roundEdit(round);
  if (edit) edit(report);
  const id = round.id;
  const fetchMock = mockApi([
    ['GET', `/api/assessments/${id}`, () => json(200, round)],
    ['GET', `/api/assessments/${id}/report`, () => json(200, report)],
    ...extra,
  ]);
  renderApp(`/rounds/${id}/report`);
  return { id, fetchMock, report, round };
}

const page = () => screen.findByTestId('screen-S10');
const loaded = async () => {
  const root = await page();
  await screen.findByTestId('grade-badge');
  return root;
};
const rowOf = (index) => screen.getAllByTestId('question-row').find((row) => row.dataset.question === String(index));

describe('the real reports from the backend', () => {
  it.each(SCENARIOS)('%s: the report opens with its grade, headline and round facts', async (name) => {
    const { report, round } = openReport(name);
    await loaded();
    expect(screen.getByTestId('grade-badge')).toHaveAttribute('data-grade', report.grade);
    expect(screen.getByTestId('headline')).toHaveTextContent(report.headline.text);
    expect(screen.getByText(formatDateTime(round.createdAt))).toBeInTheDocument();
    expect(screen.getByText(`${report.durationMin} min`, { selector: 'dd' })).toBeInTheDocument();
  });

  it('covers every grade, every failure reason and every kind of headline', () => {
    const reports = SCENARIOS.map((name) => real[name].report.body);
    expect(new Set(reports.map((r) => r.grade))).toEqual(new Set(['EXCELLENT', 'STRONG', 'SOLVED_WITH_STRUGGLE', 'PARTIAL', 'NEEDS_WORK']));
    const reasons = reports.flatMap((r) => r.questions.map((q) => q.failureReason)).filter(Boolean);
    expect(new Set(reasons)).toEqual(new Set(['TOO_SLOW', 'WRONG_ON_HIDDEN', 'WRONG_ON_SAMPLE', 'CRASH', 'SYNTAX_ERROR', 'NOT_SUBMITTED']));
    expect(reports.some((r) => r.headline.rule === null)).toBe(true);
    expect(reports.some((r) => r.headline.rule === 'TOO_EASY')).toBe(true);
  });
});

describe('header (FR17, FR18, FR19)', () => {
  it('shows the creation date and time, the duration and how it ended', async () => {
    const { round } = openReport('excellent');
    await loaded();
    expect(screen.getByText(formatDateTime(round.createdAt))).toBeInTheDocument();
    expect(screen.getByText('60 min', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Finished by you')).toBeInTheDocument();
  });

  it('a round that ran out of time says Time ran out', async () => {
    openReport('hiddenAndRisky');
    await loaded();
    expect(screen.getByText('Time ran out')).toBeInTheDocument();
    expect(screen.queryByText('Finished by you')).not.toBeInTheDocument();
  });

  it('never shows the round id (FR18)', async () => {
    const { id } = openReport('excellent');
    const root = await loaded();
    expect(root).not.toHaveTextContent(id);
  });
});

describe('grade badge: labels and colours', () => {
  const CASES = [
    ['EXCELLENT', 'Excellent', 'bg-success'],
    ['STRONG', 'Strong', 'bg-success'],
    ['SOLVED_WITH_STRUGGLE', 'Solved with struggle', 'bg-warning'],
    ['PARTIAL', 'Partially solved', 'bg-warning'],
    ['NEEDS_WORK', 'Needs work', 'bg-error-container'],
  ];
  it.each(CASES)('%s shows %s', async (grade, label, colourClass) => {
    openReport('strong', { edit: (r) => { r.grade = grade; } });
    await loaded();
    const badge = screen.getByTestId('grade-badge');
    expect(badge).toHaveTextContent(label);
    expect(badge.className).toContain(colourClass);
    expect(badge.className).toContain('border-');
  });

  it('shows no subtitle, percentile or rank next to the grade', async () => {
    openReport('strong');
    const root = await loaded();
    expect(root).not.toHaveTextContent(/top \d+%|percentile|beats|rank/i);
  });
});

describe('summary row', () => {
  it('Solved is `solved of total`, and the three times are whole minutes', async () => {
    openReport('triage');
    await loaded();
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(within(summary).getByRole('group', { name: 'Solved' })).getByText('1 of 3')).toBeInTheDocument();
    expect(within(within(summary).getByRole('group', { name: 'Time used' })).getByText('17 min')).toBeInTheDocument();
    expect(within(within(summary).getByRole('group', { name: 'Allotted' })).getByText('60 min')).toBeInTheDocument();
    expect(within(within(summary).getByRole('group', { name: 'Time left' })).getByText('43 min')).toBeInTheDocument();
  });

  it('time used reads as `h h m min` when over an hour', async () => {
    openReport('triage', {
      edit: (r) => {
        r.summary.timeUsedSec = 4500;
        r.summary.timeAllottedSec = 7200;
        r.summary.timeLeftSec = 2700;
        r.durationMin = 120;
      },
    });
    await loaded();
    const summary = screen.getByRole('region', { name: 'Summary' });
    expect(within(within(summary).getByRole('group', { name: 'Time used' })).getByText('1 h 15 min')).toBeInTheDocument();
    expect(within(within(summary).getByRole('group', { name: 'Allotted' })).getByText('120 min')).toBeInTheDocument();
    expect(within(within(summary).getByRole('group', { name: 'Time left' })).getByText('45 min')).toBeInTheDocument();
  });

  it('the time left of a round that ran out is 0 min', async () => {
    openReport('hiddenAndRisky');
    await loaded();
    const group = screen.getByRole('group', { name: 'Time left' });
    expect(within(group).getByText('0 min')).toBeInTheDocument();
  });
});

describe('headline and insights: tone and text come from the API', () => {
  it('TOO_EASY is green', async () => {
    openReport('excellent');
    await loaded();
    const headline = screen.getByTestId('headline');
    expect(headline).toHaveAttribute('data-tone', 'good');
    expect(headline.className).toContain('border-success');
    expect(headline).toHaveTextContent(real.excellent.report.body.headline.text);
  });

  it('TRIAGE is gold, with the text exactly as the API gave it', async () => {
    openReport('triage');
    await loaded();
    const headline = screen.getByTestId('headline');
    expect(headline).toHaveAttribute('data-tone', 'warning');
    expect(headline.className).toContain('border-warning');
    // The text is the API's string, word for word, in its own paragraph (the icon beside it is decoration).
    expect(within(headline).getByText(real.triage.report.body.headline.text, { exact: true }).tagName).toBe('P');
  });

  it.each([['struggle'], ['failures'], ['hiddenAndRisky']])('%s: a rule other than TOO_EASY is gold', async (name) => {
    openReport(name);
    await loaded();
    expect(screen.getByTestId('headline')).toHaveAttribute('data-tone', 'warning');
  });

  it('shows the insights in the order given, each with its text and tone', async () => {
    const { report } = openReport('failures');
    await loaded();
    const cards = screen.getAllByTestId('insight');
    expect(cards.map((c) => c.textContent)).toEqual(report.insights.map((i) => i.text));
    expect(cards.every((c) => c.getAttribute('data-tone') === 'warning')).toBe(true);
  });

  it('shows at most three insight cards', async () => {
    openReport('failures', {
      edit: (r) => {
        r.insights = [...r.insights, { rule: 'SLOWEST', question: 1, values: {}, text: 'A fourth insight.' }];
      },
    });
    await loaded();
    expect(screen.getAllByTestId('insight')).toHaveLength(3);
    expect(screen.queryByText('A fourth insight.')).not.toBeInTheDocument();
  });

  it('a TOO_EASY insight card is green', async () => {
    openReport('struggle', {
      edit: (r) => {
        r.insights = [{ rule: 'TOO_EASY', question: null, values: {}, text: 'Easy one.' }];
      },
    });
    await loaded();
    expect(screen.getByTestId('insight')).toHaveAttribute('data-tone', 'good');
  });

  it('with no insights the section is not shown', async () => {
    openReport('excellent');
    await loaded();
    expect(screen.queryByTestId('insight')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Insights' })).not.toBeInTheDocument();
  });

  it('a round with no submissions shows Needs work and the fallback headline', async () => {
    const { report } = openReport('noSubmissions');
    await loaded();
    expect(screen.getByTestId('grade-badge')).toHaveTextContent('Needs work');
    expect(report.headline.rule).toBeNull();
    expect(screen.getByTestId('headline')).toHaveTextContent(report.headline.text);
    expect(screen.getByTestId('headline')).toHaveAttribute('data-tone', 'warning');
    expect(report.summary.solved).toBe(0);
  });
});

describe('time map', () => {
  it.each(SCENARIOS)('%s: one row per question, filled minutes match activeMinutes exactly', async (name) => {
    const { report } = openReport(name);
    await loaded();
    const rows = screen.getAllByTestId('time-map-row');
    expect(rows).toHaveLength(report.timeMap.questions.length);
    report.timeMap.questions.forEach((question, position) => {
      const row = rows[position];
      expect(within(row).getByText(`Q${question.index}`)).toBeInTheDocument();
      const cells = row.querySelectorAll('[data-minute]');
      expect(cells).toHaveLength(report.timeMap.totalMinutes);
      const filled = [...row.querySelectorAll('[data-active="true"]')].map((cell) => Number(cell.dataset.minute));
      expect(filled).toEqual(question.activeMinutes);
    });
  });

  it('the scale runs from 0 to the length of the round with a tick every 5 minutes', async () => {
    openReport('excellent'); // 60 minutes
    await loaded();
    const scale = screen.getByTestId('time-map-scale');
    const ticks = [...scale.querySelectorAll('[data-tick]')].map((tick) => Number(tick.dataset.tick));
    expect(ticks).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
    expect(scale).toHaveTextContent('0');
    expect(scale).toHaveTextContent('60');
  });

  it('a 150-minute round has 150 cells per row and a tick every 5 minutes', async () => {
    openReport('failures');
    await loaded();
    const scale = screen.getByTestId('time-map-scale');
    expect(scale.querySelectorAll('[data-tick]')).toHaveLength(31);
    expect(screen.getAllByTestId('time-map-row')[0].querySelectorAll('[data-minute]')).toHaveLength(150);
  });

  it('shows the caption of the spec, word for word', async () => {
    openReport('triage');
    await loaded();
    expect(
      screen.getByText(
        'Minutes from the start of the round. Filled minutes show when you were working on each question. This is approximate, because reading without typing is not counted.',
      ),
    ).toBeInTheDocument();
  });

  it('a question with no active minutes has an empty row', async () => {
    openReport('triage'); // Q3 was never opened
    await loaded();
    const row = screen.getAllByTestId('time-map-row')[2];
    expect(row.querySelectorAll('[data-active="true"]')).toHaveLength(0);
  });

  it('a minute outside the round is not drawn', async () => {
    openReport('triage', { edit: (r) => { r.timeMap.questions[0].activeMinutes = [1, 99]; } });
    await loaded();
    const row = screen.getAllByTestId('time-map-row')[0];
    expect([...row.querySelectorAll('[data-active="true"]')].map((c) => Number(c.dataset.minute))).toEqual([1]);
  });
});

describe('question table', () => {
  it('the columns of the spec, in order', async () => {
    openReport('strong');
    await loaded();
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Question', 'Result', 'Active time', 'First run', 'Runs / submits', 'Failed submits', 'Speed', 'Why not solved', 'Flags']);
  });

  it('shows Q n · topic · difficulty, the result and the active time against the expected time', async () => {
    openReport('triage');
    await loaded();
    const q2 = rowOf(2);
    expect(q2).toHaveTextContent('Q2 · Arrays · Easy');
    expect(q2).toHaveTextContent('Not solved');
    expect(q2).toHaveTextContent('13 of 12 min');
    expect(rowOf(1)).toHaveTextContent('Solved');
    expect(rowOf(3)).toHaveTextContent('Not opened');
    expect(rowOf(3)).toHaveTextContent('0 of 12 min');
  });

  it('first run is `N min after opening`, or a dash when there was none', async () => {
    const { report } = openReport('triage');
    await loaded();
    expect(report.questions[0].firstRunAfterMin).not.toBeNull();
    expect(rowOf(1)).toHaveTextContent(`${report.questions[0].firstRunAfterMin} min after opening`);
    expect(within(rowOf(2)).getAllByRole('cell')[3]).toHaveTextContent('—');
  });

  it('runs and submits, and failed submits', async () => {
    openReport('struggle');
    await loaded();
    const cells = within(rowOf(1)).getAllByRole('cell');
    expect(cells[4]).toHaveTextContent('1 / 5');
    expect(cells[5]).toHaveTextContent('4');
  });

  it('speed is shown for solved questions only', async () => {
    const { report } = openReport('hiddenAndRisky');
    await loaded();
    const solved = report.questions[1];
    expect(solved.result).toBe('SOLVED');
    expect(within(rowOf(2)).getAllByRole('cell')[6]).toHaveTextContent('1.68 s of 2 s');
    expect(within(rowOf(1)).getAllByRole('cell')[6]).toHaveTextContent('—');
  });

  it('speed is never shown for an unsolved question, even if the API sent a time', async () => {
    openReport('triage', { edit: (r) => { r.questions[1].runtimeMs = 500; r.questions[1].timeLimitMs = 2000; } });
    await loaded();
    expect(within(rowOf(2)).getAllByRole('cell')[6]).toHaveTextContent('—');
    expect(rowOf(2)).not.toHaveTextContent('0.5 s of 2 s');
  });

  it.each([
    ['failures', 1, 'Syntax error'],
    ['failures', 2, 'Too slow on some tests'],
    ['failures', 3, 'Runtime error'],
    ['failures', 4, 'Failed a sample test'],
    ['failures', 5, 'Never submitted'],
    ['triage', 2, 'Wrong answer on some tests'],
  ])('%s Q%i: why not solved reads `%s`', async (name, index, label) => {
    openReport(name);
    await loaded();
    expect(within(rowOf(index)).getAllByRole('cell')[7]).toHaveTextContent(label);
  });

  it('a solved question has no failure label', async () => {
    openReport('strong');
    await loaded();
    for (const row of screen.getAllByTestId('question-row')) expect(within(row).getAllByRole('cell')[7]).toHaveTextContent('—');
  });

  it('flags are shown with their labels, comma-separated', async () => {
    openReport('struggle');
    await loaded();
    expect(within(rowOf(1)).getAllByRole('cell')[8]).toHaveTextContent('Many failed submits, Submitted without running');
    expect(within(rowOf(2)).getAllByRole('cell')[8]).toHaveTextContent('—');
  });

  it('shows the risky runtime flag and the slow start flag with their labels', async () => {
    openReport('hiddenAndRisky', { edit: (r) => { r.questions[1].flags = ['RISKY_RUNTIME', 'SLOW_START']; } });
    await loaded();
    expect(within(rowOf(2)).getAllByRole('cell')[8]).toHaveTextContent('Close to the time limit, Slow first run');
  });

  it('a code the page does not know shows nothing made up', async () => {
    openReport('triage', {
      edit: (r) => {
        r.questions[1].failureReason = 'SOMETHING_NEW';
        r.questions[1].flags = ['UNKNOWN_FLAG'];
      },
    });
    await loaded();
    const cells = within(rowOf(2)).getAllByRole('cell');
    expect(cells[7]).toHaveTextContent('—');
    expect(cells[8]).toHaveTextContent('—');
    expect(rowOf(2)).not.toHaveTextContent('SOMETHING_NEW');
  });
});

describe('nothing hidden and nothing invented', () => {
  it.each(SCENARIOS)('%s: no code, statements, test numbers or removed features', async (name) => {
    openReport(name);
    const root = await loaded();
    const text = root.textContent;
    expect(text).not.toMatch(/percentile|beats \d|top \d+%|export summary|solved @|\+\d+ ?min gain|pass(ed)? \d+ of \d+|test #?\d+|\btests? passed\b/i);
    expect(text).not.toMatch(/def |import |print\(|input\(|memory|\bMB\b/);
    expect(text).not.toMatch(/[A-Z_]{6,}/); // no raw API code (TOO_SLOW, NOT_SOLVED, ...) reaches the screen
  });

  it('the report call is the only call for the report data (E16), and carries the token', async () => {
    const { fetchMock, id } = openReport('excellent');
    await loaded();
    const calls = callsTo(fetchMock, `/api/assessments/${id}/report`);
    expect(calls).toHaveLength(1);
    expect(calls[0][1].headers.Authorization).toBe('Bearer tok');
  });
});

describe('Print and Back to my rounds', () => {
  it('Print calls window.print', async () => {
    const print = vi.fn();
    window.print = print;
    openReport('excellent');
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('the print styles hide the buttons and the app shell', async () => {
    openReport('excellent');
    await loaded();
    expect(screen.getByRole('button', { name: 'Print' }).parentElement).toHaveClass('print:hidden');
    expect(screen.getByRole('button', { name: 'Create this round' })).toHaveClass('print:hidden');
    expect(screen.getByLabelText('Sidebar')).toHaveClass('print:hidden');
  });

  it('Back to my rounds goes to /rounds', async () => {
    openReport('excellent');
    await loaded();
    await userEvent.click(screen.getByRole('link', { name: 'Back to my rounds' }));
    expect(location()).toBe('/rounds');
  });

  it('has no Export Summary button', async () => {
    openReport('excellent');
    await loaded();
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();
  });
});

describe('next round card', () => {
  it('shows the reason, the suggested questions and the duration from the API', async () => {
    const { report } = openReport('excellent');
    await loaded();
    const card = screen.getByTestId('next-round');
    expect(card).toHaveTextContent(report.nextRound.reason);
    const slots = within(card).getAllByTestId('next-round-slot');
    expect(slots.map((s) => s.textContent)).toEqual(['Q1 · Strings · Medium', 'Q2 · Arrays · Medium']);
    expect(card).toHaveTextContent(`Duration: ${report.nextRound.durationMin} min`);
  });

  it('Create this round sends exactly the suggested slots and duration, then opens the new round', async () => {
    const created = real.createNext201.body;
    const { report, fetchMock } = openReport('excellent', {
      extra: [
        ['POST', '/api/assessments', () => json(201, created)],
        ['GET', `/api/assessments/${created.id}`, () => json(200, roundSummary(created.id, 'READY'))],
      ],
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Create this round' }));
    await waitFor(() => expect(location()).toBe(`/rounds/${created.id}`));
    const post = callsTo(fetchMock, '/api/assessments').find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/api/assessments'));
    expect(JSON.parse(post[1].body)).toEqual({ slots: report.nextRound.slots, durationMin: report.nextRound.durationMin });
    expect(await screen.findByTestId('screen-S7')).toBeInTheDocument();
  });

  it('the button is disabled while the round is being created, so one click makes one round', async () => {
    let release;
    const { fetchMock } = openReport('excellent', {
      extra: [['POST', '/api/assessments', () => new Promise((resolve) => { release = () => resolve(json(201, real.createNext201.body)); })]],
    });
    await loaded();
    const button = screen.getByRole('button', { name: 'Create this round' });
    await userEvent.dblClick(button);
    expect(await screen.findByRole('button', { name: 'Creating…' })).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    release();
    await waitFor(() => expect(location()).toBe(`/rounds/${real.createNext201.body.id}`));
  });

  it('422 NOT_ENOUGH_PROBLEMS: the same short-group message as the round builder, next to the questions it names', async () => {
    const answer = real.createNext422;
    openReport('hardExcellent', { extra: [['POST', '/api/assessments', () => json(answer.status, answer.body)]] });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Create this round' }));
    const slots = await screen.findAllByTestId('next-round-slot');
    expect(slots).toHaveLength(2);
    for (const slot of slots) {
      expect(slot).toHaveAttribute('data-short', 'true');
      expect(slot).toHaveTextContent('Not enough hard sorting problems: 2 requested, 1 available.');
    }
    expect(location()).toBe(`/rounds/${real.hardExcellent.round.body.id}/report`);
    expect(screen.getByRole('button', { name: 'Create this round' })).toBeEnabled();
  });

  it('409 READY_LIMIT_REACHED: the banner of the spec', async () => {
    const answer = real.createNextReadyLimit;
    openReport('excellent', { extra: [['POST', '/api/assessments', () => json(answer.status, answer.body)]] });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Create this round' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have 20 ready rounds. Start or delete one first.');
    expect(screen.getByRole('button', { name: 'Create this round' })).toBeEnabled();
  });

  it('a network error shows the banner with Retry, and Retry tries again', async () => {
    let calls = 0;
    openReport('excellent', {
      extra: [
        ['POST', '/api/assessments', () => {
          calls += 1;
          if (calls === 1) throw new TypeError('Failed to fetch');
          return json(201, real.createNext201.body);
        }],
        ['GET', `/api/assessments/${real.createNext201.body.id}`, () => json(200, roundSummary(real.createNext201.body.id, 'READY'))],
      ],
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Create this round' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Can't reach the server. Check your connection.");
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(location()).toBe(`/rounds/${real.createNext201.body.id}`));
    expect(calls).toBe(2);
  });

  it('a 422 whose details are not in the documented shape shows the generic banner', async () => {
    openReport('hardExcellent', {
      extra: [['POST', '/api/assessments', () => apiError(422, 'NOT_ENOUGH_PROBLEMS', 'x', [{ unexpected: true }])]],
    });
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'Create this round' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
  });

  it('a next round with no questions has no card and no button', async () => {
    openReport('excellent', { edit: (r) => { r.nextRound.slots = []; } });
    await loaded();
    expect(screen.queryByTestId('next-round')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create this round' })).not.toBeInTheDocument();
  });
});

describe('loading, error and not-found states (FR22)', () => {
  it('shows a skeleton while the report loads', async () => {
    const { round } = saved('excellent');
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, round)],
      ['GET', `/api/assessments/${round.id}/report`, () => new Promise(() => {})],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    expect(await screen.findByLabelText('Loading report')).toBeInTheDocument();
    expect(screen.queryByTestId('grade-badge')).not.toBeInTheDocument();
  });

  it('an error shows the message with a Retry button that loads the report again', async () => {
    const { round, report } = saved('excellent');
    let calls = 0;
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, round)],
      ['GET', `/api/assessments/${round.id}/report`, () => (++calls === 1 ? apiError(500, 'INTERNAL_ERROR') : json(200, report))],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Try again.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('grade-badge')).toHaveTextContent('Excellent');
    expect(calls).toBe(2);
  });

  it('a network error shows the connection message', async () => {
    const { round } = saved('excellent');
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, round)],
      ['GET', `/api/assessments/${round.id}/report`, () => { throw new TypeError('Failed to fetch'); }],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
  });

  it('an answer that is not a report is treated as an error, not shown half-drawn', async () => {
    const { round } = saved('excellent');
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, round)],
      ['GET', `/api/assessments/${round.id}/report`, () => json(200, { grade: 'EXCELLENT' })],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.queryByTestId('grade-badge')).not.toBeInTheDocument();
  });

  it('404 shows the not-found view with a link back to My rounds (FR1)', async () => {
    const { round } = saved('excellent');
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, round)],
      ['GET', `/api/assessments/${round.id}/report`, () => json(real.reportUnknown.status, real.reportUnknown.body)],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Back to My rounds' }));
    expect(location()).toBe('/rounds');
  });

  it('409 ROUND_NOT_FINISHED routes by the status of the round (FR15)', async () => {
    const { round } = saved('excellent');
    let status = 'FINISHED';
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, status === 'FINISHED' ? round : roundSummary(round.id, 'ACTIVE'))],
      ['GET', `/api/assessments/${round.id}/report`, () => {
        status = 'ACTIVE';
        return json(real.reportOfActive.status, real.reportOfActive.body);
      }],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    await waitFor(() => expect(location()).toBe(`/rounds/${round.id}/workspace`));
  });

  it('a round that is not finished never asks for the report (FR15)', async () => {
    const { round } = saved('excellent');
    const fetchMock = mockApi([['GET', `/api/assessments/${round.id}`, () => json(200, roundSummary(round.id, 'ACTIVE'))]]);
    renderApp(`/rounds/${round.id}/report`);
    await waitFor(() => expect(location()).toBe(`/rounds/${round.id}/workspace`));
    expect(callsTo(fetchMock, '/report')).toHaveLength(0);
  });

  it('a round that does not exist shows the not-found view without asking for the report', async () => {
    const fetchMock = mockApi([['GET', '/api/assessments/missing', () => json(real.reportUnknown.status, real.reportUnknown.body)]]);
    renderApp('/rounds/missing/report');
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
    expect(callsTo(fetchMock, '/report')).toHaveLength(0);
  });

  it('401 on the report goes to /login with returnTo (FR5)', async () => {
    const { round } = saved('excellent');
    mockApi([
      ['GET', `/api/assessments/${round.id}`, () => json(200, round)],
      ['GET', `/api/assessments/${round.id}/report`, () => json(real.reportNoToken.status, real.reportNoToken.body)],
    ]);
    renderApp(`/rounds/${round.id}/report`);
    await waitFor(() => expect(location()).toContain('/login?returnTo='));
    expect(decodeURIComponent(location())).toContain(`/rounds/${round.id}/report`);
  });
});
