// ??$$$
import { create } from 'zustand';
import type { ProjectData } from '../types/project';
import { projectData } from '../data/project';

export interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  type: 'boot' | 'info' | 'input' | 'output' | 'system';
}

interface ProjectState {
  currentTab: 'landing' | 'playground';
  project: ProjectData;
  simulationRunning: boolean;
  ledState: boolean;
  buttonPressed: boolean;
  logs: LogEntry[];
  selectedFile: string;
  selectedComponent: string | null;
  showWires: boolean;
  showLabels: boolean;
  fps: number;
  cpuUsage: number;
  voltage: number;
  
  // Actions
  setTab: (tab: 'landing' | 'playground') => void;
  loadProject: (data: ProjectData) => void;
  setSimulationRunning: (running: boolean) => void;
  setLedState: (state: boolean) => void;
  setButtonPressed: (pressed: boolean) => void;
  addLog: (text: string, type?: LogEntry['type']) => void;
  clearLogs: () => void;
  setSelectedFile: (file: string) => void;
  setSelectedComponent: (key: string | null) => void;
  toggleWires: () => void;
  toggleLabels: () => void;
  resetSimulation: () => void;
  tickTelemetry: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentTab: 'landing',
  project: projectData,
  simulationRunning: false,
  ledState: false,
  buttonPressed: false,
  logs: [],
  selectedFile: 'sketch.ino',
  selectedComponent: null,
  showWires: true,
  showLabels: true,
  fps: 60,
  cpuUsage: 0,
  voltage: 0.0,

  setTab: (tab) => set({ currentTab: tab }),

  loadProject: (data) => set({ 
    project: data, 
    ledState: data.editableJson.ledInitialState,
    buttonPressed: data.editableJson.buttonInitialState
  }),

  setSimulationRunning: (running) => {
    set({ simulationRunning: running });
    
    if (running) {
      set({ voltage: 5.0, cpuUsage: 12 });
      get().addLog('[BOOT] Arduino initialized', 'boot');
      setTimeout(() => {
        if (get().simulationRunning) {
          get().addLog('[INFO] Waiting for button input', 'info');
        }
      }, 800);
    } else {
      set({ voltage: 0.0, cpuUsage: 0 });
      get().addLog('[SYSTEM] Simulation paused', 'system');
    }
  },

  setLedState: (state) => set({ ledState: state }),

  setButtonPressed: (pressed) => {
    const running = get().simulationRunning;
    set({ buttonPressed: pressed });
    
    if (running) {
      if (pressed) {
        set({ ledState: true });
        get().addLog('[INPUT] Button pressed (Pin D2: HIGH)', 'input');
        get().addLog('[OUTPUT] LED Turn ON (Pin D7: HIGH)', 'output');
      } else {
        set({ ledState: false });
        get().addLog('[INPUT] Button released (Pin D2: LOW)', 'input');
        get().addLog('[OUTPUT] LED Turn OFF (Pin D7: LOW)', 'output');
      }
    }
  },

  addLog: (text, type = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      text,
      type
    };
    set((state) => ({ logs: [...state.logs.slice(-99), newLog] }));
  },

  clearLogs: () => set({ logs: [] }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  setSelectedComponent: (key) => set({ selectedComponent: key }),

  toggleWires: () => set((state) => ({ showWires: !state.showWires })),

  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),

  resetSimulation: () => {
    const currentProj = get().project;
    set({
      simulationRunning: false,
      ledState: currentProj.editableJson.ledInitialState,
      buttonPressed: currentProj.editableJson.buttonInitialState,
      voltage: 0.0,
      cpuUsage: 0,
    });
    get().clearLogs();
    get().addLog('[SYSTEM] Simulation reset completed', 'system');
  },

  tickTelemetry: () => {
    if (!get().simulationRunning) return;
    
    // Fake fluctuations
    set((state) => {
      const baseCpu = state.buttonPressed ? 45 : 18;
      const cpuRand = Math.floor(Math.random() * 8) - 4;
      const baseFps = 60;
      const fpsRand = Math.floor(Math.random() * 4) - 2;
      const vRand = (Math.random() * 0.1 - 0.05);

      return {
        cpuUsage: Math.max(5, Math.min(99, baseCpu + cpuRand)),
        fps: Math.max(50, Math.min(64, baseFps + fpsRand)),
        voltage: Math.max(4.85, Math.min(5.15, 5.0 + vRand))
      };
    });
  }
}));
