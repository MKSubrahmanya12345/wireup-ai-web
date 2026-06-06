import { create } from 'zustand';
import { projectData } from '../data/project';
import { simulationEngine } from '../simulation/SimulationEngine';
import type { ComponentItem, ProjectData } from '../types/project';

const EMPTY_LCD_LINE = ''.padEnd(16, ' ');

const normalizeProjectData = (data: ProjectData): ProjectData => {
  const editableJson = {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false,
    ...((data.editableJson as any) || {})
  };

  return {
    ...data,
    bom: Array.isArray(data.bom) ? data.bom : [],
    wiring: Array.isArray(data.wiring) ? data.wiring : [],
    editableJson,
    milestones: Array.isArray(data.milestones) ? data.milestones : [],
    additionalTools: Array.isArray(data.additionalTools) ? data.additionalTools : []
  };
};

const parseEndpoint = (value: string) => {
  const [partKey = '', ...pinParts] = String(value || '').split('.');
  return {
    partKey: partKey.trim().toLowerCase(),
    pin: pinParts.join('.').trim()
  };
};

const normalizePin = (value: string) => {
  let pin = String(value || '').trim().toUpperCase();
  if (!pin) {
    return '';
  }

  if (pin === 'SDA') {
    return 'A4';
  }

  if (pin === 'SCL') {
    return 'A5';
  }

  if (pin === 'RX') {
    return 'D0';
  }

  if (pin === 'TX') {
    return 'D1';
  }

  if (/^GPIO\d+$/.test(pin)) {
    pin = `D${pin.slice(4)}`;
  }

  if (/^\d+$/.test(pin)) {
    pin = `D${pin}`;
  }

  return pin;
};

const matchesComponent = (item: ComponentItem, matcher: (name: string, type: string) => boolean) => {
  const name = String(item?.displayName || item?.key || '').toLowerCase();
  const type = String(item?.type || '').toLowerCase();
  return matcher(name, type);
};

const isMicrocontrollerComponent = (item: ComponentItem) =>
  matchesComponent(item, (name, type) => type === 'microcontroller' || name.includes('arduino') || name.includes('uno'));

const findWiredPin = (
  project: ProjectData,
  matcher: (item: ComponentItem) => boolean
) => {
  const componentKeys = new Set(
    project.bom.filter(matcher).map((item) => String(item.key || '').toLowerCase())
  );
  const mcuKeys = new Set(
    project.bom.filter(isMicrocontrollerComponent).map((item) => String(item.key || '').toLowerCase())
  );

  mcuKeys.add('arduino');
  mcuKeys.add('mcu');

  for (const wire of project.wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);

    if (componentKeys.has(from.partKey) && mcuKeys.has(to.partKey) && to.pin) {
      return normalizePin(to.pin);
    }

    if (componentKeys.has(to.partKey) && mcuKeys.has(from.partKey) && from.pin) {
      return normalizePin(from.pin);
    }
  }

  return '';
};

const resolveLedState = (project: ProjectData, pins: Record<string, boolean>) => {
  const pin = findWiredPin(project, (item) =>
    matchesComponent(item, (name, type) => type === 'led' || name.includes('led'))
  );

  return pin ? Boolean(pins[pin]) : false;
};

const inferLogType = (text: string): LogEntry['type'] => {
  const normalized = String(text || '').trim().toUpperCase();

  if (normalized.startsWith('[BOOT]')) {
    return 'boot';
  }

  if (normalized.startsWith('[INPUT]')) {
    return 'input';
  }

  if (normalized.startsWith('[OUTPUT]')) {
    return 'output';
  }

  if (normalized.startsWith('[SYSTEM]') || normalized.startsWith('[ERROR]') || normalized.startsWith('[SIM]')) {
    return 'system';
  }

  return 'info';
};

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
  lcdLine1: string;
  lcdLine2: string;
  lcdBacklight: boolean;
  gpioPins: Record<string, boolean>;
  logs: LogEntry[];
  selectedFile: string;
  selectedComponent: string | null;
  showWires: boolean;
  showLabels: boolean;
  fps: number;
  cpuUsage: number;
  voltage: number;

  setTab: (tab: 'landing' | 'playground') => void;
  loadProject: (data: ProjectData) => void;
  setSimulationRunning: (running: boolean) => Promise<void>;
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
  lcdLine1: EMPTY_LCD_LINE,
  lcdLine2: EMPTY_LCD_LINE,
  lcdBacklight: false,
  gpioPins: {},
  logs: [],
  selectedFile: 'sketch.ino',
  selectedComponent: null,
  showWires: true,
  showLabels: true,
  fps: 60,
  cpuUsage: 0,
  voltage: 0,

  setTab: (tab) => set({ currentTab: tab }),

  loadProject: (data) => {
    simulationEngine.stop();
    simulationEngine.clearListeners();

    const normalized = normalizeProjectData(data);
    set({
      project: normalized,
      simulationRunning: false,
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState,
      lcdLine1: EMPTY_LCD_LINE,
      lcdLine2: EMPTY_LCD_LINE,
      lcdBacklight: false,
      gpioPins: {},
      voltage: 0,
      cpuUsage: 0
    });
  },

  setSimulationRunning: async (running) => {
    if (!running) {
      simulationEngine.stop();
      simulationEngine.clearListeners();
      set({
        simulationRunning: false,
        voltage: 0,
        cpuUsage: 0,
        ledState: false,
        lcdLine1: EMPTY_LCD_LINE,
        lcdLine2: EMPTY_LCD_LINE,
        lcdBacklight: false,
        gpioPins: {}
      });
      get().addLog('[SYSTEM] Simulation paused', 'system');
      return;
    }

    if (get().simulationRunning) {
      return;
    }

    const project = normalizeProjectData(get().project);

    simulationEngine.stop();
    simulationEngine.clearListeners();

    simulationEngine.onLCDUpdate((line1, line2, backlight) => {
      set({
        lcdLine1: line1,
        lcdLine2: line2,
        lcdBacklight: backlight
      });
    });

    simulationEngine.onGPIOUpdate((pins) => {
      set({
        gpioPins: pins,
        ledState: resolveLedState(project, pins)
      });
    });

    simulationEngine.onSerial((text) => {
      get().addLog(text, inferLogType(text));
    });

    simulationEngine.onLog((text, type) => {
      get().addLog(text, type);
    });

    try {
      await simulationEngine.start(project.sketch || '', project.bom, project.wiring);
      set({
        simulationRunning: true,
        voltage: 5,
        cpuUsage: 14,
        lcdLine1: EMPTY_LCD_LINE,
        lcdLine2: EMPTY_LCD_LINE,
        lcdBacklight: false,
        buttonPressed: false
      });
    } catch (error: any) {
      simulationEngine.stop();
      simulationEngine.clearListeners();
      set({
        simulationRunning: false,
        voltage: 0,
        cpuUsage: 0,
        lcdBacklight: false
      });
      get().addLog(`[ERROR] ${error?.message || 'Failed to start simulation'}`, 'system');
    }
  },

  setLedState: (state) => set({ ledState: state }),

  setButtonPressed: (pressed) => {
    const running = get().simulationRunning;
    set({ buttonPressed: pressed });

    if (!running) {
      return;
    }

    if (pressed) {
      simulationEngine.pressButton();
      get().addLog('[INPUT] Button pressed (INPUT_PULLUP -> LOW)', 'input');
      return;
    }

    simulationEngine.releaseButton();
    get().addLog('[INPUT] Button released (INPUT_PULLUP -> HIGH)', 'input');
  },

  addLog: (text, type = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).slice(2, 11),
      timestamp: new Date().toLocaleTimeString(),
      text,
      type
    };

    set((state) => ({
      logs: [...state.logs.slice(-99), newLog]
    }));
  },

  clearLogs: () => set({ logs: [] }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  setSelectedComponent: (key) => set({ selectedComponent: key }),

  toggleWires: () => set((state) => ({ showWires: !state.showWires })),

  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),

  resetSimulation: () => {
    simulationEngine.stop();
    simulationEngine.clearListeners();

    const normalized = normalizeProjectData(get().project);
    set({
      simulationRunning: false,
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState,
      lcdLine1: EMPTY_LCD_LINE,
      lcdLine2: EMPTY_LCD_LINE,
      lcdBacklight: false,
      gpioPins: {},
      voltage: 0,
      cpuUsage: 0
    });
    get().clearLogs();
    get().addLog('[SYSTEM] Simulation reset completed', 'system');
  },

  tickTelemetry: () => {
    if (!get().simulationRunning) {
      return;
    }

    set((state) => {
      const cpuJitter = Math.floor(Math.random() * 8) - 4;
      const fpsJitter = Math.floor(Math.random() * 4) - 2;
      const voltageJitter = Math.random() * 0.08 - 0.04;

      return {
        cpuUsage: Math.max(6, Math.min(95, 18 + (state.buttonPressed ? 10 : 0) + cpuJitter)),
        fps: Math.max(50, Math.min(61, 60 + fpsJitter)),
        voltage: Math.max(4.9, Math.min(5.1, 5 + voltageJitter))
      };
    });
  }
}));
