// Monaco is bundled with the app, not loaded from a public CDN, so the editor works offline and a
// timed round never depends on a third-party server. Only the Python language and the editor worker
// are included. This file is loaded only by the workspace (see CodeEditor).
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/editor.all.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

loader.config({ monaco });

// Colours come only from DESIGN.md (FR21): Code Editor & Terminal Pane, plus the palette tokens.
// DESIGN.md has no syntax colours, so tokens use its palette: coral, sage green, amber, warm grey.
const EDITOR = '#1C1A18';
const GUTTER = '#23201D';
const GUTTER_BORDER = '#2C2824';
const ACTIVE_LINE = '#2A2622';
const BORDER = '#2F2B27';
const MUTED = '#77736E';
const TEXT = '#FAF7F0';
const CORAL = '#F47745';
const SAGE = '#6B9B78';
const AMBER = '#E9B95B';
const SOFT_ORANGE = '#F6A16F';

const hex = (color) => color.slice(1); // Monaco token rules want the colour without the #

export const THEME_NAME = 'oa-warm';

monaco.editor.defineTheme(THEME_NAME, {
  base: 'vs-dark',
  // Not inherited: the stock dark theme has blue and teal tokens, and DESIGN.md allows no cold colours.
  inherit: false,
  rules: [
    { token: '', foreground: hex(TEXT) },
    { token: 'keyword', foreground: hex(CORAL) },
    { token: 'string', foreground: hex(SAGE) },
    { token: 'string.escape', foreground: hex(SOFT_ORANGE) },
    { token: 'number', foreground: hex(AMBER) },
    { token: 'comment', foreground: hex(MUTED), fontStyle: 'italic' },
    { token: 'predefined', foreground: hex(SOFT_ORANGE) },
    { token: 'operator', foreground: hex(TEXT) },
    { token: 'delimiter', foreground: hex(TEXT) },
  ],
  colors: {
    'editor.background': EDITOR,
    'editor.foreground': TEXT,
    'editorGutter.background': GUTTER,
    'editorLineNumber.foreground': MUTED,
    'editorLineNumber.activeForeground': TEXT,
    'editor.lineHighlightBackground': ACTIVE_LINE,
    'editor.lineHighlightBorder': ACTIVE_LINE,
    'editorCursor.foreground': CORAL,
    'editor.selectionBackground': BORDER,
    'editor.inactiveSelectionBackground': GUTTER_BORDER,
    'editor.selectionHighlightBackground': GUTTER_BORDER,
    'editor.wordHighlightBackground': GUTTER_BORDER,
    'editor.findMatchBackground': BORDER,
    'editor.findMatchHighlightBackground': GUTTER_BORDER,
    'editorBracketMatch.background': BORDER,
    'editorBracketMatch.border': CORAL,
    'editorIndentGuide.background1': GUTTER_BORDER,
    'editorIndentGuide.activeBackground1': MUTED,
    'editorWhitespace.foreground': GUTTER_BORDER,
    'editorWidget.background': GUTTER,
    'editorWidget.border': BORDER,
    'editorSuggestWidget.background': GUTTER,
    'editorSuggestWidget.border': BORDER,
    'editorSuggestWidget.selectedBackground': ACTIVE_LINE,
    'editorSuggestWidget.highlightForeground': CORAL,
    'input.background': EDITOR,
    'input.border': BORDER,
    'focusBorder': CORAL,
    'scrollbarSlider.background': BORDER,
    'scrollbarSlider.hoverBackground': GUTTER_BORDER,
    'scrollbarSlider.activeBackground': MUTED,
  },
});

export default monaco;
