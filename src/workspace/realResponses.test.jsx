// The workspace against responses saved from the real backend (src/test/fixtures/real-workspace-responses.json).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CODE_CHARS } from '../config/limits';
import real from '../test/fixtures/real-workspace-responses.json';
import { json, mockApi, renderApp, storeSession, stubApiBase } from '../test/helpers';

const ROUND = real.getActiveBeforeOpen.body;
const ID = ROUND.id;
const noContent = () => new Response(null, { status: 204 });
const saved = (key) => (real[key].status === 204 ? noContent() : json(real[key].status, real[key].body));

beforeEach(() => {
  stubApiBase();
  storeSession();
  // The real deadline is 5 minutes after the real serverTime, so run the clock from the server's own time.
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(ROUND.serverTime));
});
afterEach(() => vi.useRealTimers());

const advance = (ms) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const location = () => screen.getByTestId('location').textContent;

async function openReal({ open = {}, save = () => noContent(), finish, getRound = () => json(200, ROUND) } = {}) {
  const calls = { open: [], save: [], finish: 0 };
  const routes = [['GET', `/api/assessments/${ID}`, getRound]];
  for (const index of [1, 2]) {
    routes.push([
      'POST',
      `/api/assessments/${ID}/questions/${index}/open`,
      () => {
        calls.open.push(index);
        return open[index] ? open[index]() : saved(index === 1 ? 'openQ1' : 'openQ2');
      },
    ]);
    routes.push([
      'PUT',
      `/api/assessments/${ID}/questions/${index}/code`,
      (url, init) => {
        calls.save.push({ index, code: JSON.parse(init.body).code });
        return save(index);
      },
    ]);
  }
  routes.push(['POST', `/api/assessments/${ID}/finish`, () => (calls.finish += 1, finish ? finish() : saved('finishManual'))]);
  mockApi(routes);
  renderApp(`/rounds/${ID}/workspace`);
  await screen.findByTestId('screen-S8');
  return { calls, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
}

const editor = () => screen.getByLabelText('Code editor');

describe('the real E12 response (question 1)', () => {
  it('has only the fields the spec lists, and no hidden data', () => {
    expect(Object.keys(real.openQ1.body).sort()).toEqual(
      ['code', 'constraints', 'difficulty', 'index', 'inputFormat', 'outputFormat', 'samples', 'serverTime', 'statement', 'title', 'topic'],
    );
    for (const sample of real.openQ1.body.samples) {
      expect(Object.keys(sample).sort()).toEqual(['explanation', 'input', 'output']);
    }
    expect(JSON.stringify(real.openQ1.body)).not.toMatch(/hidden|passwordHash|failedTestNumber/i);
  });

  it('is shown in the problem panel: title, statement, formats, constraints and every sample', async () => {
    await openReal();
    const problem = await screen.findByRole('article', { name: 'Problem' });
    const q = real.openQ1.body;
    expect(within(problem).getByRole('heading', { name: q.title })).toBeInTheDocument();
    expect(problem.querySelector('p.whitespace-pre-wrap').textContent).toBe(q.statement);
    expect(problem).toHaveTextContent(q.constraints.replace(/\s+/g, ' ').slice(0, 20));
    const samples = within(problem).getAllByRole('listitem', { name: /^Sample \d+$/ });
    expect(samples).toHaveLength(q.samples.length);
    q.samples.forEach((sample, i) => {
      const pres = [...samples[i].querySelectorAll('pre')].map((p) => p.textContent);
      expect(pres).toEqual([sample.input, sample.output]);
    });
  });

  it('shows nothing the response did not contain', async () => {
    await openReal();
    await screen.findByRole('article', { name: 'Problem' });
    const text = screen.getByRole('article', { name: 'Problem' }).textContent;
    expect(text).not.toMatch(/hidden|test case|tests? passed|memory|runtime/i);
  });

  it('the tab shows the topic and difficulty, never the title (FD9)', async () => {
    await openReal();
    await screen.findByRole('article', { name: 'Problem' });
    const first = screen.getAllByRole('tab')[0].textContent;
    expect(first).toMatch(/^Q1 · Arrays · Easy/);
    expect(first).not.toContain(real.openQ1.body.title);
  });
});

describe('the saved code comes back from the real server', () => {
  it('puts the code that E12 returned after a save in the editor', async () => {
    await openReal({ open: { 1: () => saved('openQ1AfterSave') } });
    await screen.findByRole('article', { name: 'Problem' });
    expect(editor()).toHaveValue(real.openQ1AfterSave.body.code);
    expect(editor()).toHaveValue('print("saved")\n');
  });
});

describe('real E13 answers', () => {
  it('204 makes the code Saved', async () => {
    const { calls } = await openReal({ save: () => saved('saveOk') });
    await screen.findByRole('article', { name: 'Problem' });
    fireEvent.change(editor(), { target: { value: 'print("saved")\n' } });
    await advance(1600);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Saved'));
    expect(calls.save).toEqual([{ index: 1, code: 'print("saved")\n' }]);
  });

  it('the real backend accepts exactly 51,200 characters, so the browser sends them', async () => {
    expect(real.saveExactLimit.status).toBe(204);
    const { calls } = await openReal({ save: () => saved('saveExactLimit') });
    await screen.findByRole('article', { name: 'Problem' });
    fireEvent.change(editor(), { target: { value: 'y'.repeat(MAX_CODE_CHARS) } });
    await advance(1600);
    await waitFor(() => expect(calls.save).toHaveLength(1));
    expect(screen.queryByText(/longer than/)).not.toBeInTheDocument();
  });

  it('the real backend refuses 51,201 characters, and the browser does not even send them', async () => {
    expect(real.saveTooLarge.status).toBe(413);
    const { calls } = await openReal();
    await screen.findByRole('article', { name: 'Problem' });
    fireEvent.change(editor(), { target: { value: 'x'.repeat(MAX_CODE_CHARS + 1) } });
    await advance(5000);
    expect(screen.getByText('Your code is longer than 51,200 characters.')).toBeInTheDocument();
    expect(calls.save).toEqual([]);
  });

  it('a real CODE_TOO_LARGE answer shows the same message', async () => {
    await openReal({ save: () => saved('saveTooLarge') });
    await screen.findByRole('article', { name: 'Problem' });
    fireEvent.change(editor(), { target: { value: 'x = 1' } });
    await advance(1600);
    expect(await screen.findByText('Your code is longer than 51,200 characters.')).toBeInTheDocument();
    expect(editor()).toHaveValue('x = 1');
  });

  it('a real ROUND_EXPIRED goes to the report', async () => {
    let status = 'ACTIVE';
    await openReal({
      getRound: () => json(200, status === 'ACTIVE' ? ROUND : real.getExpired.body),
      save: () => {
        status = 'FINISHED';
        return saved('saveExpired');
      },
    });
    await screen.findByRole('article', { name: 'Problem' });
    fireEvent.change(editor(), { target: { value: 'late' } });
    await advance(1600);
    await screen.findByTestId('screen-S10');
    expect(location()).toBe(`/rounds/${ID}/report`);
  });

  it('a real ROUND_NOT_ACTIVE (the round was finished in another tab) routes by status', async () => {
    let status = 'ACTIVE';
    await openReal({
      getRound: () => json(200, status === 'ACTIVE' ? ROUND : real.getExpired.body),
      save: () => {
        status = 'FINISHED';
        return saved('saveAfterManualFinish');
      },
    });
    await screen.findByRole('article', { name: 'Problem' });
    fireEvent.change(editor(), { target: { value: 'late' } });
    await advance(1600);
    await screen.findByTestId('screen-S10');
  });
});

describe('real E12 errors', () => {
  it('a real ROUND_EXPIRED goes to the report', async () => {
    let status = 'ACTIVE';
    mockApi([
      ['GET', `/api/assessments/${ID}`, () => json(200, status === 'ACTIVE' ? ROUND : real.getExpired.body)],
      ['POST', `/api/assessments/${ID}/questions/1/open`, () => ((status = 'FINISHED'), saved('openExpired'))],
    ]);
    renderApp(`/rounds/${ID}/workspace`);
    await screen.findByTestId('screen-S10');
  });

  it('a real ROUND_NOT_ACTIVE routes by status', async () => {
    let status = 'ACTIVE';
    mockApi([
      ['GET', `/api/assessments/${ID}`, () => json(200, status === 'ACTIVE' ? ROUND : real.getExpired.body)],
      ['POST', `/api/assessments/${ID}/questions/1/open`, () => ((status = 'FINISHED'), saved('openAfterManualFinish'))],
    ]);
    renderApp(`/rounds/${ID}/workspace`);
    await screen.findByTestId('screen-S10');
  });

  it('a real NOT_FOUND (a question number that does not exist) shows the not-found view', async () => {
    mockApi([
      ['GET', `/api/assessments/${ID}`, () => json(200, ROUND)],
      ['POST', `/api/assessments/${ID}/questions/1/open`, () => saved('openQ9')],
    ]);
    renderApp(`/rounds/${ID}/workspace`);
    expect(await screen.findByTestId('round-not-found')).toBeInTheDocument();
  });
});

describe('real E11 (Finish)', () => {
  const confirmFinish = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Finish round' }));
  };

  it('a real 200 sends the student to the report', async () => {
    let status = 'ACTIVE';
    const { calls, user } = await openReal({
      getRound: () => json(200, status === 'ACTIVE' ? ROUND : real.getExpired.body),
      finish: () => ((status = 'FINISHED'), saved('finishManual')),
    });
    await screen.findByRole('article', { name: 'Problem' });
    await confirmFinish(user);
    await screen.findByTestId('screen-S10');
    expect(calls.finish).toBe(1);
  });

  it('is safe to repeat: the real backend answers the same 200 twice', () => {
    expect(real.finishManual.status).toBe(200);
    expect(real.finishManualAgain.status).toBe(200);
    // Everything is the same except the time of the answer itself.
    const { serverTime: _a, ...first } = real.finishManual.body;
    const { serverTime: _b, ...again } = real.finishManualAgain.body;
    expect(again).toEqual(first);
  });
});

describe('the real round after time runs out', () => {
  it('the workspace counts down to 0:00 from the real deadline, then the real E8 says FINISHED and the report opens', async () => {
    expect(real.getExpired.body.status).toBe('FINISHED');
    expect(real.getExpired.body.finishReason).toBe('EXPIRED');
    let status = 'ACTIVE';
    await openReal({ getRound: () => json(200, status === 'ACTIVE' ? ROUND : real.getExpired.body) });
    await screen.findByRole('article', { name: 'Problem' });
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('05:00');
    status = 'FINISHED'; // the real server closes the round at its deadline
    await advance(5 * 60 * 1000 + 1500);
    await screen.findByTestId('screen-S10');
    expect(location()).toBe(`/rounds/${ID}/report`);
  });

  it('the real answers agree on the deadline: E10, E8 before and E8 after expiry', () => {
    expect(real.start.body.deadline).toBe(real.getActiveBeforeOpen.body.deadline);
    expect(real.getExpired.body.deadline).toBe(real.start.body.deadline);
    expect(Date.parse(real.start.body.deadline) - Date.parse(real.start.body.startedAt)).toBe(5 * 60 * 1000);
  });
});
