// FR21: colours, fonts, radii, shadows and spacing come only from DESIGN.md.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../tailwind.config.js';

const ROOT = process.cwd();
const design = readFileSync(join(ROOT, 'design/warm_tech_assessment/DESIGN.md'), 'utf8');

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGBA = /rgba?\([^)]*\)/g;
const squash = (s) => s.replace(/\s+/g, '').toLowerCase();

const allowedHex = new Set((design.match(HEX) || []).map((h) => h.toLowerCase()));
const allowedRgba = new Set((design.match(RGBA) || []).map(squash));
const allowedFonts = new Set([
  'Plus Jakarta Sans',
  'Inter',
  'JetBrains Mono',
  'Material Symbols Outlined',
  'sans-serif',
  'monospace',
]);

function sourceFiles() {
  const out = [join(ROOT, 'tailwind.config.js'), join(ROOT, 'index.html')];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'test') walk(full);
      } else if (/\.(js|jsx|css)$/.test(name) && !/\.test\./.test(name)) {
        out.push(full);
      }
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

describe('FR21: no colour or font outside DESIGN.md', () => {
  it('DESIGN.md itself was found and has colours', () => {
    expect(allowedHex.size).toBeGreaterThan(40);
  });

  it('every hex colour in the source is a DESIGN.md colour', () => {
    const bad = [];
    for (const file of sourceFiles()) {
      for (const hex of readFileSync(file, 'utf8').match(HEX) || []) {
        if (!allowedHex.has(hex.toLowerCase())) bad.push(`${relative(ROOT, file)}: ${hex}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every rgb/rgba value in the source is a DESIGN.md value', () => {
    const bad = [];
    for (const file of sourceFiles()) {
      for (const value of readFileSync(file, 'utf8').match(RGBA) || []) {
        if (!allowedRgba.has(squash(value))) bad.push(`${relative(ROOT, file)}: ${value}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every colour in the Tailwind config is a DESIGN.md colour', () => {
    const colors = Object.entries(tailwindConfig.theme.extend.colors);
    const bad = colors.filter(([, v]) => !allowedHex.has(v.toLowerCase())).map(([k, v]) => `${k}: ${v}`);
    expect(bad).toEqual([]);
  });

  it('the front-matter colour tokens match DESIGN.md exactly', () => {
    const front = design.split('---')[1];
    const tokens = [...front.matchAll(/^ {2}([a-z-]+): '(#[0-9a-fA-F]{6})'$/gm)];
    expect(tokens.length).toBeGreaterThan(40);
    const colors = tailwindConfig.theme.extend.colors;
    const mismatched = tokens
      .filter(([, name, hex]) => colors[name]?.toLowerCase() !== hex.toLowerCase())
      .map(([, name, hex]) => `${name}: expected ${hex}, config has ${colors[name]}`);
    expect(mismatched).toEqual([]);
  });

  it('every font family in the Tailwind config is a DESIGN.md font', () => {
    const families = Object.values(tailwindConfig.theme.extend.fontFamily).flat();
    expect(families.filter((f) => !allowedFonts.has(f))).toEqual([]);
  });

  it('every font-family in the CSS is a DESIGN.md font', () => {
    const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8');
    const names = [...css.matchAll(/font-family:\s*([^;]+);/g)].flatMap((m) =>
      m[1].split(',').map((n) => n.trim().replace(/^['"]|['"]$/g, '')),
    );
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((n) => !allowedFonts.has(n))).toEqual([]);
  });

  it('index.html loads only the DESIGN.md fonts', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const loaded = [...html.matchAll(/family=([A-Za-z+]+)/g)].map((m) => m[1].replace(/\+/g, ' '));
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.filter((n) => !allowedFonts.has(n))).toEqual([]);
    expect(new Set(loaded)).toEqual(
      new Set(['Inter', 'JetBrains Mono', 'Plus Jakarta Sans', 'Material Symbols Outlined']),
    );
  });

  it('uses no cold-spectrum Tailwind colour names (DESIGN.md: zero blue)', () => {
    const cold = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|shadow)-(?:blue|sky|cyan|teal|indigo|violet|navy)-\d{2,3}\b/;
    const hits = sourceFiles().filter((f) => cold.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
