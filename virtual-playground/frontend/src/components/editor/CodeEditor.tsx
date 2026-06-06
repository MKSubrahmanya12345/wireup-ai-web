// ??$$$ non-important
// ??$$$
import React from 'react';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../../store/useProjectStore';
import { FileCode, FileJson, Lock } from 'lucide-react';

export const CodeEditor: React.FC = () => {
  const { selectedFile, setSelectedFile, project } = useProjectStore();

  const tabs = [
    { name: 'sketch.ino', type: 'code' },
    { name: 'wiring.json', type: 'json' },
    { name: 'editable.json', type: 'json' },
    { name: 'scenario.json', type: 'json' },
    { name: 'project.json', type: 'json' },
  ];

  // Dynamically get editor content
  const getEditorContent = () => {
    switch (selectedFile) {
      case 'sketch.ino':
        return project.sketch;
      case 'wiring.json':
        return JSON.stringify(project.wiring, null, 2);
      case 'editable.json':
        return JSON.stringify(project.editableJson, null, 2);
      case 'scenario.json':
        return JSON.stringify({
          scenarioName: "Workspace Session",
          description: "Compile the currently loaded sketch and drive the currently loaded components from the project payload.",
          objectives: [
            { id: 1, text: "Load BOM, wiring, and sketch from the active project", status: "PENDING" },
            { id: 2, text: "Compile sketch.ino into AVR firmware", status: "PENDING" },
            { id: 3, text: "Reflect real sketch outputs in the scene", status: "PENDING" }
          ],
          autorun: true,
          voltageVcc: 5.0
        }, null, 2);
      case 'project.json':
        return JSON.stringify(project, null, 2);
      default:
        return '';
    }
  };

  const getLanguage = () => {
    if (selectedFile.endsWith('.ino')) return 'cpp';
    if (selectedFile.endsWith('.json')) return 'json';
    return 'plaintext';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--surface)] border-l border-[var(--border)]">
      {/* File Editor Tabs */}
      <div className="h-9 bg-[var(--surface-alt)] border-b border-[var(--border)] flex items-center justify-between px-3 select-none">
        <div className="flex h-full space-x-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isSelected = selectedFile === tab.name;
            const Icon = tab.type === 'code' ? FileCode : FileJson;
            
            return (
              <button
                key={tab.name}
                onClick={() => setSelectedFile(tab.name)}
                className={`h-full px-4 flex items-center space-x-2 border-r border-[#252526] text-xs font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-blue-700 border-t-2 border-t-blue-600 font-semibold'
                    : 'bg-[var(--surface-alt)] text-[var(--text-muted)] hover:bg-white hover:text-[var(--heading)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-[var(--text-muted)]'}`} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
        
        {/* Editor Info Badge */}
        <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[var(--text-muted)] bg-white px-2 py-0.5 rounded border border-[var(--border)]">
          <Lock className="w-3 h-3" />
          <span>READ-ONLY MODE</span>
        </div>
      </div>

      {/* Monaco Editor Canvas */}
      <div className="flex-1 min-h-0 relative">
        <Editor
          height="100%"
          language={getLanguage()}
          theme="vs-dark"
          value={getEditorContent()}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12.5,
            fontFamily: 'Fira Code, Consolas, Courier New, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            cursorBlinking: 'smooth',
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
};
