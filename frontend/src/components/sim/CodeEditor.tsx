// ??$$$ group 4 - Build & Firmware Compilation (Phase 3), group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
import React from 'react';
import Editor from '@monaco-editor/react';

export function CodeEditor({ value, onChange }) {
  return (
    <Editor
      height="100%"
      language="cpp"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        padding: { top: 12, bottom: 12 },
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
      }}
    />
  );
}

