import Editor from '@monaco-editor/react';
import { memo } from 'react';
import { THEME_NAME } from '../monaco/setup';

// FD12: Monaco with Python only. There is no language choice.
// One model per question (`path`), so each question keeps its own undo history.
function CodeEditor({ path, value, onChange, readOnly }) {
  return (
    <Editor
      height="100%"
      language="python"
      theme={THEME_NAME}
      path={path}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      loading={<div aria-hidden="true" className="h-full w-full bg-editor animate-pulse" />}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        lineHeight: 22,
        tabSize: 4,
        insertSpaces: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderLineHighlight: 'line',
        padding: { top: 12, bottom: 12 },
        contextmenu: false,
      }}
    />
  );
}

export default memo(CodeEditor);
