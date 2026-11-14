import { ApiError, request } from './client';

// A 2xx response that is not the documented shape is treated as INTERNAL_ERROR (same idea as FR9).
function expectShape(ok) {
  if (!ok) {
    throw new ApiError({ status: 200, code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' });
  }
}

const isObject = (value) => value !== null && typeof value === 'object';

// E5: GET /api/topics -> { topics: [{ topic, easy, medium, hard }] }
export async function getTopics(options) {
  const data = await request('/api/topics', options);
  expectShape(isObject(data) && Array.isArray(data.topics));
  return data.topics;
}

// E6: POST /api/assessments -> 201 round summary (status READY)
export async function createRound({ slots, durationMin }, options) {
  const data = await request('/api/assessments', { ...options, method: 'POST', body: { slots, durationMin } });
  expectShape(isObject(data) && typeof data.id === 'string');
  return data;
}

// E7: GET /api/assessments?status&page&limit -> { items, page, limit, total }
export async function listRounds({ status, page, limit }, options) {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (page) query.set('page', String(page));
  if (limit) query.set('limit', String(limit));
  const suffix = query.toString() ? `?${query}` : '';
  const data = await request(`/api/assessments${suffix}`, options);
  expectShape(isObject(data) && Array.isArray(data.items) && typeof data.total === 'number');
  return data;
}

const STATUSES = ['READY', 'ACTIVE', 'FINISHED'];
const isRoundSummary = (data) => isObject(data) && Array.isArray(data.slots) && STATUSES.includes(data.status);

// E8: GET /api/assessments/:id -> round summary (never statements, samples or code)
export async function getRound(id, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}`, options);
  expectShape(isRoundSummary(data));
  return data;
}

// E10: POST /api/assessments/:id/start -> 200 round summary with startedAt, deadline and serverTime
export async function startRound(id, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}/start`, { ...options, method: 'POST' });
  expectShape(isRoundSummary(data));
  return data;
}

// E9: DELETE /api/assessments/:id -> 204 (READY rounds only)
export function deleteRound(id, options) {
  return request(`/api/assessments/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' });
}

// E11: POST /api/assessments/:id/finish -> 200 round summary (safe to repeat)
export async function finishRound(id, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}/finish`, { ...options, method: 'POST' });
  expectShape(isRoundSummary(data));
  return data;
}

// E12: POST /api/assessments/:id/questions/:index/open -> the question, with title, statement, samples and saved code.
// The backend spec (section 4.4) defines this as POST, and it starts that question's clock the first time.
export async function openQuestion(id, index, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}/questions/${index}/open`, {
    ...options,
    method: 'POST',
  });
  expectShape(isObject(data) && typeof data.title === 'string' && Array.isArray(data.samples));
  return data;
}

// E13: PUT /api/assessments/:id/questions/:index/code -> 204 (autosave)
export function saveCode(id, index, code, options) {
  return request(`/api/assessments/${encodeURIComponent(id)}/questions/${index}/code`, {
    ...options,
    method: 'PUT',
    body: { code },
  });
}

const isCount = (value) => typeof value === 'number' && Number.isFinite(value);
const text = (value) => (typeof value === 'string' ? value : '');

// E14: POST /api/assessments/:id/questions/:index/run (samples only). The answer is cut down to the
// fields the screen shows. Anything else in a response is dropped, so nothing hidden can be displayed (FR20).
export async function runCode(id, index, code, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}/questions/${index}/run`, {
    ...options,
    method: 'POST',
    body: { language: 'python', code },
  });
  expectShape(isObject(data) && Array.isArray(data.results) && isCount(data.runsLeft) && isCount(data.testsPassed) && isCount(data.totalTests));
  return {
    compilation: isObject(data.compilation) ? { message: text(data.compilation.message) } : null,
    results: data.results.map((r) => ({
      input: text(r.input),
      expected: text(r.expected),
      actual: text(r.actual),
      passed: r.passed === true,
      status: r.status,
      error: typeof r.error === 'string' ? r.error : null,
    })),
    testsPassed: data.testsPassed,
    totalTests: data.totalTests,
    runsLeft: data.runsLeft,
  };
}

const VERDICTS = ['ACCEPTED', 'NOT_ACCEPTED', 'COMPILATION_ERROR'];

// E15: POST /api/assessments/:id/questions/:index/submit. Only these three verdicts exist for the student
// (backend D27). A verdict that is none of them is not shown, and no reason or test number is ever kept.
export async function submitCode(id, index, code, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}/questions/${index}/submit`, {
    ...options,
    method: 'POST',
    body: { language: 'python', code },
  });
  expectShape(isObject(data) && VERDICTS.includes(data.verdict) && isCount(data.submitsLeft) && typeof data.solved === 'boolean');
  return {
    verdict: data.verdict,
    errorMessage: data.verdict === 'COMPILATION_ERROR' ? text(data.errorMessage) : null,
    solved: data.solved,
    submitsLeft: data.submitsLeft,
  };
}

const GRADES = ['EXCELLENT', 'STRONG', 'SOLVED_WITH_STRUGGLE', 'PARTIAL', 'NEEDS_WORK'];
const RESULTS = ['SOLVED', 'NOT_SOLVED', 'NOT_OPENED'];
const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const isInsight = (item) => isObject(item) && typeof item.text === 'string';
const insightOf = (item) => ({ rule: typeof item.rule === 'string' ? item.rule : null, question: numberOrNull(item.question), text: item.text });

// E16: GET /api/assessments/:id/report. The answer is cut down to the fields the report shows, so nothing
// else (and nothing hidden) can end up on the page.
export async function getReport(id, options) {
  const data = await request(`/api/assessments/${encodeURIComponent(id)}/report`, options);
  expectShape(
    isObject(data) &&
      GRADES.includes(data.grade) &&
      isObject(data.summary) &&
      isInsight(data.headline) &&
      Array.isArray(data.insights) &&
      data.insights.every(isInsight) &&
      Array.isArray(data.questions) &&
      data.questions.every((q) => isObject(q) && RESULTS.includes(q.result) && isCount(q.index)) &&
      isObject(data.timeMap) &&
      isCount(data.timeMap.totalMinutes) &&
      Array.isArray(data.timeMap.questions) &&
      isObject(data.nextRound) &&
      Array.isArray(data.nextRound.slots) &&
      isCount(data.nextRound.durationMin),
  );
  const s = data.summary;
  return {
    durationMin: data.durationMin,
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    finishReason: data.finishReason ?? null,
    grade: data.grade,
    summary: {
      solved: s.solved,
      total: s.total,
      timeUsedSec: s.timeUsedSec,
      timeAllottedSec: s.timeAllottedSec,
      timeLeftSec: s.timeLeftSec,
    },
    headline: insightOf(data.headline),
    insights: data.insights.map(insightOf),
    questions: data.questions.map((q) => ({
      index: q.index,
      topic: text(q.topic),
      difficulty: text(q.difficulty),
      result: q.result,
      activeMin: numberOrNull(q.activeMin) ?? 0,
      expectedMin: numberOrNull(q.expectedMin) ?? 0,
      firstRunAfterMin: numberOrNull(q.firstRunAfterMin),
      runCount: numberOrNull(q.runCount) ?? 0,
      submitCount: numberOrNull(q.submitCount) ?? 0,
      failedSubmits: numberOrNull(q.failedSubmits) ?? 0,
      runtimeMs: numberOrNull(q.runtimeMs),
      timeLimitMs: numberOrNull(q.timeLimitMs),
      failureReason: typeof q.failureReason === 'string' && q.failureReason ? q.failureReason : null,
      flags: Array.isArray(q.flags) ? q.flags.filter((f) => typeof f === 'string') : [],
    })),
    timeMap: {
      totalMinutes: data.timeMap.totalMinutes,
      questions: data.timeMap.questions.map((q) => ({
        index: q.index,
        activeMinutes: Array.isArray(q.activeMinutes) ? q.activeMinutes.filter((m) => Number.isInteger(m)) : [],
      })),
    },
    nextRound: {
      reason: text(data.nextRound.reason),
      slots: data.nextRound.slots.map((slot) => ({ topic: text(slot.topic), difficulty: text(slot.difficulty) })),
      durationMin: data.nextRound.durationMin,
    },
  };
}
