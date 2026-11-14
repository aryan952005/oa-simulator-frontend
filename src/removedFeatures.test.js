// F7: a search of the source for features and text that the frontend spec removes ("Removed" in S1 to S10),
// for text that would break FR10 and FR20, and for leftovers. Comments are ignored, because a comment may
// say what was removed. Test files and fixtures are not scanned: they may mention these words on purpose.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

// [screen or rule, pattern, what it catches]
export const FORBIDDEN = [
  // S1 Landing
  ['S1', /pass rate/i, 'a made-up statistic'],
  ['S1', /response time/i, 'a made-up statistic'],
  ['S1', /Python 3\.\d/i, 'the Python version (also S7)'],
  ['S1', /testimonial/i, 'testimonials (also S2)'],
  ['S1', /runs? in (your|the) browser|in-browser (runner|execution)/i, 'in-browser runner claims'],
  // S2 Login
  ['S2', /forgot (your )?password/i, 'Forgot password'],
  ['S2', /remember (me|session|this (device|browser))/i, 'Remember session'],
  ['S2', /verified (credentials|student)|student e-?mail/i, 'verified-credentials and student-email text'],
  ['S2', /(sign in|log in|continue|sign up) with (google|github|apple|linkedin|microsoft)/i, 'social login'],
  // S3 Register
  ['S3', /honou?r code/i, 'the honor-code checkbox'],
  ['S3', /password strength|strength (bar|meter)/i, 'the strength bar (replaced by a checklist, FD4)'],
  // S4 Dashboard
  ['S4', /PRO PLAN/, 'the PRO PLAN card'],
  ['S4', /\bCandidate\b/, 'the Candidate role text'],
  ['S4', />\s*Performance\s*</, 'the Performance menu item'],
  ['S4', /\d+% (completion|complete)|completion rate/i, 'the total solved percentage'],
  // S5 Round builder
  ['S5', /target preset|company preset/i, 'Target preset'],
  ['S5', /lockdown|full-?screen (mode|lock)/i, 'the full-screen lockdown'],
  ['S5', /camera|window[- ]switch/i, 'camera and window-switch text'],
  ['S5', /total (problem )?pool|pool of \d+/i, 'the total pool count'],
  // S6 My rounds
  ['S6', /type=["']search["']|placeholder=["']?search/i, 'search'],
  ['S6', /sort by|sort (order|options)/i, 'sort options'],
  ['S6', /schedule new mock/i, 'Schedule New Mock'],
  ['S6', /round #\d+/i, 'round numbers'],
  ['S6', /success rate/i, 'the success rate'],
  // S7 Round details
  ['S7', /expires in \d+ days?/i, '`Expires in 7 days`'],
  ['S7', /sandbox|latency/i, 'latency and sandbox text'],
  ['S7', /memory cap|keymap/i, 'the memory cap and the keymap options'],
  // S8 Workspace and S9 results
  ['S8', /reset code/i, 'Reset Code (FD5)'],
  ['S8', /scratchpad/i, 'scratchpad notes'],
  ['S8', /custom input/i, 'custom inputs'],
  ['S8', /\bJava\b|C\+\+|TypeScript/, 'Java, C++ and TypeScript'],
  ['S8', /language (selector|picker)|select language/i, 'the language selector (D2)'],
  ['S8', /edge-cases/i, 'text such as `all 45 hidden test edge-cases`'],
  ['S8', /\bstdout\b|terminal output/i, 'the timestamped stdout console'],
  ['S8', /\bmemory\b|\d+ ?MB\b/i, 'the memory header (also FR20)'],
  // S10 Report
  ['S10', /percentile/i, 'percentiles'],
  ['S10', /\bbeats\b/i, '`Beats X%`'],
  ['S10', /export summary/i, 'Export Summary'],
  ['S10', /solved @|\+\d+ ?min gain/i, '`Solved @ 30m` and `+14 min gain`'],
  ['S10', /\btop \d+ ?%/i, 'ranks'],
  // FR20: no hidden test data, test numbers, or the number of hidden tests
  ['FR20', /\d+ hidden tests?|hidden tests? (count|number)|test case #?\d+/i, 'hidden test counts and numbers'],
  // FR10: the client never logs request or response bodies. Nothing logs at all.
  ['FR10', /console\.(log|debug|info|dir|table)\(/, 'logging'],
  // Leftovers
  ['leftover', /\bdebugger\b/, 'a debugger statement'],
  ['leftover', /lorem ipsum/i, 'placeholder text'],
  ['leftover', /\b(TODO|FIXME|XXX)\b/, 'an unfinished note'],
  ['leftover', /\bPlaceholder\b/, 'the F0 placeholder screens'],
];

// Removes // and /* */ comments, keeping the line numbers.
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

export function findForbidden(source) {
  const hits = [];
  stripComments(source).split('\n').forEach((line, i) => {
    for (const [screen, pattern, what] of FORBIDDEN) {
      if (pattern.test(line)) hits.push({ line: i + 1, screen, what, text: line.trim().slice(0, 100) });
    }
  });
  return hits;
}

function sourceFiles() {
  const out = [join(ROOT, 'index.html')];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'test') walk(full);
      } else if (/\.(js|jsx|css|html)$/.test(name) && !/\.test\./.test(name)) {
        out.push(full);
      }
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

describe('the search itself works', () => {
  it.each(FORBIDDEN.map(([screen, pattern, what]) => [screen, what, pattern]))('%s: finds %s', (screen, what, pattern) => {
    // Each pattern must match some text, or it could never catch anything.
    const samples = {
      'a made-up statistic': ['pass rate', 'response time'],
      'the Python version (also S7)': ['Python 3.12'],
      'testimonials (also S2)': ['Testimonial'],
      'in-browser runner claims': ['Runs in your browser', 'in-browser runner'],
      'Forgot password': ['Forgot password?'],
      'Remember session': ['Remember me'],
      'verified-credentials and student-email text': ['Verified credentials', 'student email'],
      'social login': ['Continue with Google'],
      'the honor-code checkbox': ['honor code'],
      'the strength bar (replaced by a checklist, FD4)': ['Password strength'],
      'the PRO PLAN card': ['PRO PLAN'],
      'the Candidate role text': ['Candidate'],
      'the Performance menu item': ['<span>Performance</span>'],
      'the total solved percentage': ['75% Completion'],
      'Target preset': ['Target preset'],
      'the full-screen lockdown': ['lockdown'],
      'camera and window-switch text': ['camera', 'window switch'],
      'the total pool count': ['total pool', 'pool of 40'],
      search: ['type="search"', 'placeholder="Search rounds"'],
      'sort options': ['Sort by date'],
      'Schedule New Mock': ['Schedule New Mock'],
      'round numbers': ['Round #8'],
      'the success rate': ['Success rate'],
      '`Expires in 7 days`': ['Expires in 7 days'],
      'latency and sandbox text': ['sandbox', 'latency'],
      'the memory cap and the keymap options': ['memory cap', 'keymap'],
      'Reset Code (FD5)': ['Reset Code'],
      'scratchpad notes': ['Scratchpad'],
      'custom inputs': ['Custom input'],
      'Java, C++ and TypeScript': ['Java', 'C++', 'TypeScript'],
      'the language selector (D2)': ['language selector'],
      'text such as `all 45 hidden test edge-cases`': ['all 45 hidden test edge-cases'],
      'the timestamped stdout console': ['stdout'],
      'the memory header (also FR20)': ['memory', '24 MB'],
      percentiles: ['92nd percentile'],
      '`Beats X%`': ['Beats 94%'],
      'Export Summary': ['Export Summary'],
      '`Solved @ 30m` and `+14 min gain`': ['Solved @ 30m', '+14 min gain'],
      ranks: ['TOP 18%'],
      'hidden test counts and numbers': ['45 hidden tests', 'test case 7'],
      logging: ['console.log(x)'],
      'a debugger statement': ['debugger;'],
      'placeholder text': ['Lorem ipsum'],
      'an unfinished note': ['TODO: later', 'FIXME'],
      'the F0 placeholder screens': ['<Placeholder />'],
    }[what];
    expect(samples, `a sample for ${what}`).toBeTruthy();
    // A group can hold several patterns (for example two statistics), so each pattern must match at least one sample.
    expect(samples.some((sample) => pattern.test(sample)), `${screen}: ${pattern}`).toBe(true);
  });

  it('ignores comments, keeps line numbers, and does not cut a URL out of a string', () => {
    expect(findForbidden('// Removed: Forgot password\nconst a = 1;')).toEqual([]);
    expect(findForbidden('/* Reset Code\n   is gone */\nconst a = 1;')).toEqual([]);
    expect(findForbidden('const a = 1;\nconst b = "Forgot password"; // x')).toMatchObject([{ line: 2, screen: 'S2' }]);
    expect(findForbidden('const url = "http://localhost:5001"; const b = "Reset Code";')).toHaveLength(1);
  });

  it('does not flag the words the spec itself uses', () => {
    const allowed = [
      'Python 3', 'JavaScript', 'This workspace needs a wider screen.', 'Some test cases did not pass.',
      'Your solution passed all tests.', 'Run: 2 of 3 sample tests passed', 'Failed a sample test', 'Wrong answer on some tests',
      'Create account', 'Log in', 'My rounds', 'Round report', 'Hi, Alex', 'Not enough easy arrays problems: 3 requested, 2 available.',
    ];
    for (const text of allowed) expect(findForbidden(`const t = ${JSON.stringify(text)};`), text).toEqual([]);
  });
});

describe('F7: no removed feature or forbidden text in the source', () => {
  const files = sourceFiles();

  it('scans the whole source (and index.html)', () => {
    expect(files.length).toBeGreaterThan(60);
    expect(files.some((f) => f.endsWith('Workspace.jsx'))).toBe(true);
    expect(files.some((f) => f.endsWith('index.html'))).toBe(true);
    expect(files.some((f) => /\.test\./.test(f))).toBe(false);
  });

  it('finds nothing', () => {
    const found = [];
    for (const file of files) {
      for (const hit of findForbidden(readFileSync(file, 'utf8'))) {
        found.push(`${relative(ROOT, file)}:${hit.line} [${hit.screen}] ${hit.what}: ${hit.text}`);
      }
    }
    expect(found).toEqual([]);
  });
});
