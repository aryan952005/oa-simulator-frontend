// FR27 and FD10: topics come only from E5. No topic name may be written into the code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import real from './test/fixtures/real-rounds-responses.json';

const ROOT = join(process.cwd(), 'src');

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'test') walk(full);
      } else if (/\.(js|jsx)$/.test(name) && !/\.test\./.test(name)) {
        out.push(full);
      }
    }
  };
  walk(ROOT);
  return out;
}

describe('FR27: topics are not written into the code', () => {
  it('no topic name from the real E5 response appears in the app source', () => {
    const topics = real.topics.body.topics.map((t) => t.topic);
    expect(topics.length).toBeGreaterThan(0);
    const hits = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const topic of topics) {
        if (new RegExp(`['"\`]${topic}['"\`]`, 'i').test(text)) hits.push(`${relative(ROOT, file)}: ${topic}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
