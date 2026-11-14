import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiError,
  callsTo,
  json,
  mockApi,
  realRound,
  realRoundBody,
  renderApp,
  storeSession,
  stubApiBase,
} from '../test/helpers';

beforeEach(() => {
  stubApiBase();
  storeSession();
});

const location = () => screen.getByTestId('location').textContent;
const topicsRoute = (topics) => ['GET', '/api/topics', () => json(200, { topics })];
const createRoute = (handler) => ['POST', '/api/assessments', handler];

// A bank with room for repeated questions, and a topic with a gap (graphs has no easy or hard problems).
const BANK = [
  { topic: 'arrays', easy: 2, medium: 5, hard: 1 },
  { topic: 'graphs', easy: 0, medium: 3, hard: 0 },
];

const card = (n) => screen.getByRole('region', { name: `Question ${n}` });
const cards = () => screen.getAllByRole('region', { name: /^Question \d+$/ });
const radio = (n, name) => within(card(n)).getByRole('radio', { name });
const createButton = () => screen.getByRole('button', { name: /^Create round$|^Creating/ });
const durationInput = () => screen.getByLabelText('Duration (minutes)');
const flagged = () => cards().map((c) => c.getAttribute('data-flagged') === 'true');

async function openBuilder(routes = [topicsRoute(BANK)]) {
  const user = userEvent.setup();
  const fetchMock = mockApi(routes);
  renderApp('/rounds/new');
  await screen.findByRole('region', { name: 'Question 1' });
  return { user, fetchMock };
}

async function setDuration(user, text) {
  const input = durationInput();
  await user.clear(input);
  if (text) await user.type(input, text);
}

describe('S5 loading, error and empty states (FR22)', () => {
  it('asks E5 once on open and shows a skeleton first', async () => {
    let resolve;
    const fetchMock = mockApi([['GET', '/api/topics', () => new Promise((r) => (resolve = r))]]);
    renderApp('/rounds/new');
    expect(await screen.findByLabelText('Loading topics')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Question 1' })).not.toBeInTheDocument();
    resolve(json(200, { topics: BANK }));
    await screen.findByRole('region', { name: 'Question 1' });
    expect(callsTo(fetchMock, '/api/topics')).toHaveLength(1);
    expect(screen.queryByLabelText('Loading topics')).not.toBeInTheDocument();
  });

  it('shows the error with a Retry button, and Retry loads the topics', async () => {
    let up = false;
    const fetchMock = mockApi([['GET', '/api/topics', () => (up ? json(200, { topics: BANK }) : apiError(500, 'INTERNAL_ERROR'))]]);
    const user = userEvent.setup();
    renderApp('/rounds/new');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('region', { name: 'Question 1' });
    expect(callsTo(fetchMock, '/api/topics')).toHaveLength(2);
  });

  it('shows a network error with Retry', async () => {
    mockApi([
      [
        'GET',
        '/api/topics',
        () => {
          throw new TypeError('Failed to fetch');
        },
      ],
    ]);
    renderApp('/rounds/new');
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows an empty state when E5 returns no topics, and no way to create a round', async () => {
    mockApi([topicsRoute([])]);
    renderApp('/rounds/new');
    expect(await screen.findByText('No questions are available yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Create round$/ })).not.toBeInTheDocument();
  });
});

describe('S5 topics come only from E5', () => {
  it('lists exactly the topics E5 returned, and no others', async () => {
    await openBuilder();
    const options = within(card(1)).getByLabelText('Topic').querySelectorAll('option');
    expect([...options].map((o) => o.value)).toEqual(['arrays', 'graphs']);
    expect([...options].map((o) => o.textContent)).toEqual(['Arrays', 'Graphs']);
  });

  it('a topic that E5 left out (it has no problems) does not appear', async () => {
    await openBuilder([topicsRoute([{ topic: 'math', easy: 1, medium: 0, hard: 0 }])]);
    const select = within(card(1)).getByLabelText('Topic');
    expect([...select.querySelectorAll('option')].map((o) => o.value)).toEqual(['math']);
    expect(screen.queryByText('Arrays')).not.toBeInTheDocument();
    expect(screen.queryByText('Strings')).not.toBeInTheDocument();
  });

  it('shows the topics of the real E5 response', async () => {
    const { user } = await openBuilder([['GET', '/api/topics', () => realRound('topics')]]);
    const options = within(card(1)).getByLabelText('Topic').querySelectorAll('option');
    expect([...options].map((o) => o.value)).toEqual(['arrays', 'strings', 'hashing', 'sorting', 'math']);
    await user.selectOptions(within(card(1)).getByLabelText('Topic'), 'math');
    expect(radio(1, /Easy/)).toBeEnabled();
  });
});

describe('S5 layout and defaults', () => {
  it('starts with 3 questions and a valid form', async () => {
    await openBuilder();
    expect(cards()).toHaveLength(3);
    expect(screen.getByTestId('question-count')).toHaveTextContent('3');
    expect(screen.getByTestId('summary-questions')).toHaveTextContent('3');
    expect(createButton()).toBeEnabled();
    expect(flagged()).toEqual([false, false, false]);
  });

  it('gives each new question a topic and difficulty that still has problems', async () => {
    await openBuilder();
    // arrays easy has 2 problems, so the first two are easy and the third moves to medium
    expect(radio(1, /Easy/)).toBeChecked();
    expect(radio(2, /Easy/)).toBeChecked();
    expect(radio(3, /Medium/)).toBeChecked();
  });

  it('each difficulty option shows the count from E5, and an option with 0 is disabled', async () => {
    const { user } = await openBuilder();
    expect(radio(1, /Easy/)).toHaveTextContent('2');
    expect(radio(1, /Medium/)).toHaveTextContent('5');
    expect(radio(1, /Hard/)).toHaveTextContent('1');
    await user.selectOptions(within(card(1)).getByLabelText('Topic'), 'graphs');
    expect(radio(1, /Easy/)).toBeDisabled();
    expect(radio(1, /Medium/)).toBeEnabled();
    expect(radio(1, /Hard/)).toBeDisabled();
  });

  it('shows how many problems are available for the chosen topic and difficulty', async () => {
    const { user } = await openBuilder();
    expect(within(card(1)).getByText('2 problems available')).toBeInTheDocument();
    await user.click(radio(1, /Medium/));
    expect(within(card(1)).getByText('5 problems available')).toBeInTheDocument();
    await user.click(radio(1, /Hard/));
    expect(within(card(1)).getByText('1 problem available')).toBeInTheDocument();
  });

  it('changing to a topic that has none at the current difficulty moves to a difficulty that has some', async () => {
    const { user } = await openBuilder();
    expect(radio(1, /Easy/)).toBeChecked();
    await user.selectOptions(within(card(1)).getByLabelText('Topic'), 'graphs');
    expect(radio(1, /Medium/)).toBeChecked();
  });

  it('a disabled difficulty cannot be chosen', async () => {
    const { user } = await openBuilder();
    await user.selectOptions(within(card(1)).getByLabelText('Topic'), 'graphs');
    await user.click(radio(1, /Easy/));
    expect(radio(1, /Medium/)).toBeChecked();
  });
});

describe('S5 question count', () => {
  it('+ adds a question up to 5, and − removes the last one down to 1', async () => {
    const { user } = await openBuilder();
    const more = screen.getByRole('button', { name: 'More questions' });
    const fewer = screen.getByRole('button', { name: 'Fewer questions' });
    await user.click(more);
    await user.click(more);
    expect(cards()).toHaveLength(5);
    expect(more).toBeDisabled();
    for (let i = 0; i < 4; i += 1) await user.click(fewer);
    expect(cards()).toHaveLength(1);
    expect(fewer).toBeDisabled();
    expect(screen.getByTestId('question-count')).toHaveTextContent('1');
  });

  it('Remove is disabled when only one question remains', async () => {
    const { user } = await openBuilder();
    expect(screen.getByRole('button', { name: 'Remove question 1' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Remove question 3' }));
    await user.click(screen.getByRole('button', { name: 'Remove question 2' }));
    expect(cards()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove question 1' })).toBeDisabled();
  });

  it('Remove takes out that question and renumbers the rest', async () => {
    const { user } = await openBuilder();
    await user.click(radio(1, /Hard/)); // Q1 hard, Q2 easy, Q3 medium
    await user.click(screen.getByRole('button', { name: 'Remove question 1' }));
    expect(cards()).toHaveLength(2);
    expect(radio(1, /Easy/)).toBeChecked(); // the old Q2 is now Q1
    expect(radio(2, /Medium/)).toBeChecked();
  });
});

describe('S5 summary and the duration rule', () => {
  it('shows the question count and the suggested minutes (the sum for each difficulty)', async () => {
    const { user } = await openBuilder();
    // Q1 easy 12, Q2 easy 12, Q3 medium 20
    expect(screen.getByTestId('summary-suggested')).toHaveTextContent('44');
    await user.click(radio(3, /Hard/));
    expect(screen.getByTestId('summary-suggested')).toHaveTextContent('54');
  });

  it('with one question of easy, the duration defaults to 12', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('button', { name: 'Remove question 3' }));
    await user.click(screen.getByRole('button', { name: 'Remove question 2' }));
    expect(radio(1, /Easy/)).toBeChecked();
    expect(durationInput()).toHaveValue('12');
    expect(screen.getByTestId('summary-suggested')).toHaveTextContent('12');
  });

  it('the duration follows the difficulties until the student types in it', async () => {
    const { user } = await openBuilder();
    expect(durationInput()).toHaveValue('44');
    await user.click(radio(3, /Hard/));
    expect(durationInput()).toHaveValue('54'); // still following
    await setDuration(user, '90');
    expect(durationInput()).toHaveValue('90');
    await user.click(radio(1, /Hard/)); // the suggestion changes to 72 ...
    expect(screen.getByTestId('summary-suggested')).toHaveTextContent('72');
    expect(durationInput()).toHaveValue('90'); // ... but the typed duration stays put
  });

  it('Use suggested resets the duration, and it follows again', async () => {
    const { user } = await openBuilder();
    await setDuration(user, '90');
    await user.click(screen.getByRole('button', { name: 'Use suggested' }));
    expect(durationInput()).toHaveValue('44');
    await user.click(radio(1, /Hard/));
    expect(durationInput()).toHaveValue('62');
  });

  it('typing in the duration field and then clearing it does not bring the suggestion back by itself', async () => {
    const { user } = await openBuilder();
    await setDuration(user, '');
    expect(durationInput()).toHaveValue('');
  });
});

describe('S5 availability check (before any request)', () => {
  async function makeThreeEasy(user) {
    await user.click(radio(3, /Easy/)); // arrays easy now appears 3 times, but only 2 exist
  }

  it('flags every card of a short group and disables Create round', async () => {
    const { user, fetchMock } = await openBuilder();
    await makeThreeEasy(user);
    expect(flagged()).toEqual([true, true, true]);
    for (const n of [1, 2, 3]) {
      expect(within(card(n)).getByText('Only 2 problems available for this topic and difficulty.')).toBeInTheDocument();
    }
    expect(createButton()).toBeDisabled();
    await user.click(createButton());
    expect(callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('flags only the cards of the short group', async () => {
    const { user } = await openBuilder();
    await user.click(screen.getByRole('button', { name: 'More questions' })); // Q4: arrays medium
    await user.click(radio(1, /Hard/)); // Q1 hard
    await user.click(radio(2, /Hard/)); // Q2 hard (only 1 hard exists)
    expect(flagged()).toEqual([true, true, false, false]);
    expect(within(card(1)).getByText('Only 1 problem available for this topic and difficulty.')).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
  });

  it('Create round is enabled again once the problem is fixed', async () => {
    const { user } = await openBuilder();
    await makeThreeEasy(user);
    expect(createButton()).toBeDisabled();
    await user.click(radio(3, /Medium/));
    expect(flagged()).toEqual([false, false, false]);
    expect(createButton()).toBeEnabled();
  });
});

describe('S5 Create round', () => {
  it('sends E6 with the slots in order and the duration, then goes to the round', async () => {
    const created = realRoundBody('createRoundOk');
    const { user, fetchMock } = await openBuilder([
      topicsRoute(BANK),
      createRoute(() => json(201, created)),
    ]);
    await user.click(radio(2, /Hard/)); // Q1 easy, Q2 hard, Q3 medium
    await user.click(createButton());
    await screen.findByTestId('screen-S7');
    const [post] = callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST');
    expect(post[0]).toBe('http://api.test/api/assessments');
    expect(JSON.parse(post[1].body)).toEqual({
      slots: [
        { topic: 'arrays', difficulty: 'easy' },
        { topic: 'arrays', difficulty: 'hard' },
        { topic: 'arrays', difficulty: 'medium' },
      ],
      durationMin: 62,
    });
    expect(location()).toBe(`/rounds/${created.id}`);
  });

  it('a round with one question can be created', async () => {
    const created = realRoundBody('createRoundOneEasy');
    const { user, fetchMock } = await openBuilder([topicsRoute(BANK), createRoute(() => json(201, created))]);
    await user.click(screen.getByRole('button', { name: 'Remove question 3' }));
    await user.click(screen.getByRole('button', { name: 'Remove question 2' }));
    await user.click(createButton());
    await screen.findByTestId('screen-S7');
    const [post] = callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ slots: [{ topic: 'arrays', difficulty: 'easy' }], durationMin: 12 });
    expect(location()).toBe(`/rounds/${created.id}`);
  });

  it('sends the typed duration, and does not send the internal card ids', async () => {
    const { user, fetchMock } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRoundOk'))]);
    await setDuration(user, '75');
    await user.click(createButton());
    await screen.findByTestId('screen-S7');
    const [post] = callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST');
    const body = JSON.parse(post[1].body);
    expect(body.durationMin).toBe(75);
    expect(body.slots.every((s) => Object.keys(s).sort().join() === 'difficulty,topic')).toBe(true);
  });

  it('shows a loading state and sends one request when clicked twice', async () => {
    let resolve;
    const { user, fetchMock } = await openBuilder([
      topicsRoute(BANK),
      createRoute(() => new Promise((r) => (resolve = r))),
    ]);
    await user.click(createButton());
    const busy = screen.getByRole('button', { name: 'Creating…' });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    resolve(realRound('createRoundOk'));
    await screen.findByTestId('screen-S7');
  });
});

describe('S5 duration validation', () => {
  it.each(['4', '181', '0', 'abc', '12.5', ''])('blocks %j with a message and no request', async (text) => {
    const { user, fetchMock } = await openBuilder();
    await setDuration(user, text);
    await user.click(createButton());
    expect(durationInput()).toHaveAccessibleDescription('Enter a whole number from 5 to 180.');
    expect(callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it.each(['5', '180'])('allows the limit %s', async (text) => {
    const { user, fetchMock } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRoundOk'))]);
    await setDuration(user, text);
    await user.click(createButton());
    await screen.findByTestId('screen-S7');
    const [post] = callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body).durationMin).toBe(Number(text));
  });

  it('shows the message while typing a bad value, and clears it when the value is fixed', async () => {
    const { user } = await openBuilder();
    await setDuration(user, '3');
    expect(durationInput()).toHaveAccessibleDescription('Enter a whole number from 5 to 180.');
    await setDuration(user, '30');
    expect(durationInput()).not.toHaveAccessibleDescription('Enter a whole number from 5 to 180.');
  });
});

describe('S5 errors (real backend responses)', () => {
  it('a 422 highlights exactly the slots named in details', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRound422OneGroup'))]);
    await user.click(createButton());
    await waitFor(() => expect(flagged()).toEqual([true, true, false]));
    // The real response names slots 1 and 2: arrays easy, 2 requested, 1 available
    for (const n of [1, 2]) {
      expect(within(card(n)).getByText('Not enough easy arrays problems: 2 requested, 1 available.')).toBeInTheDocument();
    }
    expect(within(card(3)).queryByText(/Not enough/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(location()).toBe('/rounds/new');
  });

  it('a 422 with two short groups marks both groups', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRound422TwoGroups'))]);
    await user.click(screen.getByRole('button', { name: 'More questions' })); // 4 cards
    await user.click(createButton());
    await waitFor(() => expect(flagged()).toEqual([true, true, true, true]));
    const second = realRoundBody('createRound422TwoGroups').error.details[1];
    expect(
      within(card(2)).getByText(
        `Not enough ${second.difficulty} ${second.topic} problems: ${second.requested} requested, ${second.available} available.`,
      ),
    ).toBeInTheDocument();
    expect(within(card(1)).getByText(/Not enough easy arrays problems: 2 requested, 1 available\./)).toBeInTheDocument();
  });

  it('a 422 that names only slot 2 marks only question 2', async () => {
    const body = {
      error: {
        code: 'NOT_ENOUGH_PROBLEMS',
        message: 'x',
        details: [{ slots: [2], topic: 'graphs', difficulty: 'medium', requested: 1, available: 0 }],
      },
    };
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => json(422, body))]);
    await user.click(createButton());
    await waitFor(() => expect(flagged()).toEqual([false, true, false]));
    expect(within(card(2)).getByText('Not enough medium graphs problems: 1 requested, 0 available.')).toBeInTheDocument();
  });

  it('the highlight goes away when the student changes the questions', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRound422OneGroup'))]);
    await user.click(createButton());
    await waitFor(() => expect(flagged()).toEqual([true, true, false]));
    await user.click(radio(2, /Medium/));
    expect(flagged()).toEqual([false, false, false]);
  });

  it('the student can try again after a 422', async () => {
    let first = true;
    const { user, fetchMock } = await openBuilder([
      topicsRoute(BANK),
      createRoute(() => {
        if (first) {
          first = false;
          return realRound('createRound422OneGroup');
        }
        return realRound('createRoundOk');
      }),
    ]);
    await user.click(createButton());
    await waitFor(() => expect(flagged()).toEqual([true, true, false]));
    await user.click(createButton());
    await screen.findByTestId('screen-S7');
    expect(callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
  });

  it('VALIDATION_ERROR for the duration shows under the duration field', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRoundValidationDuration'))]);
    await setDuration(user, '90'); // passes the browser check; the (real) backend answer is shown
    await user.click(createButton());
    await waitFor(() => expect(durationInput()).toHaveAccessibleDescription('Number must be less than or equal to 180'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('VALIDATION_ERROR that names no known field shows a banner', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRoundValidationSlots'))]);
    await user.click(createButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid input');
  });

  it('READY_LIMIT_REACHED shows the banner from section 3.3', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => realRound('createRoundReadyLimit'))]);
    await user.click(createButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have 20 ready rounds. Start or delete one first.',
    );
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(location()).toBe('/rounds/new');
  });

  it('a network error shows a banner with Retry, and Retry creates the round', async () => {
    let up = false;
    const { user, fetchMock } = await openBuilder([
      topicsRoute(BANK),
      createRoute(() => {
        if (!up) throw new TypeError('Failed to fetch');
        return realRound('createRoundOk');
      }),
    ]);
    await user.click(createButton());
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Check your connection.");
    up = true;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByTestId('screen-S7');
    expect(callsTo(fetchMock, '/api/assessments').filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
  });

  it('INTERNAL_ERROR shows a banner with Retry', async () => {
    const { user } = await openBuilder([topicsRoute(BANK), createRoute(() => apiError(500, 'INTERNAL_ERROR', 'boom'))]);
    await user.click(createButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('S5 removed from the design', () => {
  it('does not show the preset, lockdown, camera, pool total or made-up subtitles', async () => {
    await openBuilder();
    const text = document.body.textContent;
    expect(text).not.toMatch(/preset|lockdown|camera|window switch|anti-cheat|proctor/i);
    expect(text).not.toMatch(/pool/i);
    expect(text).not.toMatch(/Primary Algorithmic|Graph Traversal|Data Structures & Trees/i);
    expect(text).not.toMatch(/\d+\s*%/);
  });
});
