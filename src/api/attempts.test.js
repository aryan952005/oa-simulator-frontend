import { beforeEach, describe, expect, it } from 'vitest';
import { apiError, json, mockFetch, storeSession, stubApiBase } from '../test/helpers';
import { runCode, submitCode } from './rounds';

beforeEach(() => {
  stubApiBase();
  storeSession('tok');
});

const sampleRun = () => ({
  compilation: null,
  results: [{ input: '1', expected: '2', actual: '2', passed: true, status: 'OK', error: null }],
  testsPassed: 1,
  totalTests: 1,
  runsLeft: 29,
  serverTime: '2026-11-12T10:00:00.000Z',
});

describe('runCode (E14)', () => {
  it('sends POST with { language: "python", code } to the question', async () => {
    const fetchMock = mockFetch(() => json(200, sampleRun()));
    await runCode('r1', 2, 'print(1)');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/assessments/r1/questions/2/run');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ language: 'python', code: 'print(1)' });
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('returns only the fields the screen shows', async () => {
    mockFetch(() => json(200, { ...sampleRun(), hiddenTests: ['secret'], failedTestNumber: 7, memoryKb: 900, serverTime: 'x' }));
    const data = await runCode('r1', 1, 'x');
    expect(Object.keys(data).sort()).toEqual(['compilation', 'results', 'runsLeft', 'testsPassed', 'totalTests']);
  });

  it('keeps for each sample only input, expected, actual, passed, status and error', async () => {
    const body = sampleRun();
    body.results[0] = { ...body.results[0], testNumber: 3, hiddenInput: 'nope', timeMs: 12 };
    mockFetch(() => json(200, body));
    const data = await runCode('r1', 1, 'x');
    expect(Object.keys(data.results[0]).sort()).toEqual(['actual', 'error', 'expected', 'input', 'passed', 'status']);
  });

  it('a syntax error keeps only its message', async () => {
    mockFetch(() => json(200, { ...sampleRun(), compilation: { message: 'Line 3: SyntaxError: invalid syntax', line: 3, extra: 1 }, results: [], testsPassed: 0 }));
    const data = await runCode('r1', 1, 'x');
    expect(data.compilation).toEqual({ message: 'Line 3: SyntaxError: invalid syntax' });
    expect(data.results).toEqual([]);
  });

  it('an answer that is not a Run result is an INTERNAL_ERROR', async () => {
    mockFetch(() => json(200, { hello: 'world' }));
    await expect(runCode('r1', 1, 'x')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('passes API errors on unchanged', async () => {
    mockFetch(() => apiError(429, 'COOLDOWN', 'wait', { retryAfterMs: 1500 }));
    await expect(runCode('r1', 1, 'x')).rejects.toMatchObject({ code: 'COOLDOWN', retryAfterSeconds: 2 });
  });
});

describe('submitCode (E15)', () => {
  it('sends POST with { language: "python", code } to the question', async () => {
    const fetchMock = mockFetch(() => json(200, { verdict: 'ACCEPTED', solved: true, submitsLeft: 19 }));
    await submitCode('r1', 3, 'print(2)');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/assessments/r1/questions/3/submit');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ language: 'python', code: 'print(2)' });
  });

  it.each(['ACCEPTED', 'NOT_ACCEPTED'])('%s keeps only the verdict, solved and submitsLeft', async (verdict) => {
    mockFetch(() =>
      json(200, { verdict, solved: false, submitsLeft: 5, serverTime: 't', failedTestNumber: 9, testsPassed: 4, totalTests: 20, reason: 'WRONG_ANSWER', hidden: [1] }),
    );
    const data = await submitCode('r1', 1, 'x');
    expect(Object.keys(data).sort()).toEqual(['errorMessage', 'solved', 'submitsLeft', 'verdict']);
    expect(data.errorMessage).toBeNull();
  });

  it('COMPILATION_ERROR keeps its message', async () => {
    mockFetch(() => json(200, { verdict: 'COMPILATION_ERROR', errorMessage: 'Line 2: SyntaxError', solved: false, submitsLeft: 5 }));
    expect((await submitCode('r1', 1, 'x')).errorMessage).toBe('Line 2: SyntaxError');
  });

  it.each(['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'accepted', '', undefined, null])(
    'a verdict that is not one of the three (%s) is an INTERNAL_ERROR, so a reason can never be shown',
    async (verdict) => {
      mockFetch(() => json(200, { verdict, solved: false, submitsLeft: 5 }));
      await expect(submitCode('r1', 1, 'x')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    },
  );

  it('an answer without counters is an INTERNAL_ERROR', async () => {
    mockFetch(() => json(200, { verdict: 'ACCEPTED' }));
    await expect(submitCode('r1', 1, 'x')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
