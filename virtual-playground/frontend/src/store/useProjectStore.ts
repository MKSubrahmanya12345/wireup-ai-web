import { create } from 'zustand';
import { projectData } from '../data/project';
import { simulationEngine } from '../simulation/SimulationEngine';
import type { ComponentItem, ProjectData, Wiring } from '../types/project';

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

// ??$$$ newer code — power/ground rail pin names — never valid GPIO signal pins
const POWER_PINS = new Set([
  'GND', 'VCC', '5V', '3V3', '3.3V', 'VIN', 'AREF', 'RESET',
  'K', 'C', // LED cathode legs often wired to GND via these
]);

// ??$$$ newer code — build undirected adjacency graph of wiring connections
// so we can resolve multi-hop paths like mcu.D13 -> resistor.1 -> led.A
const buildWiringGraph = (wiring: Wiring[]) => {
  // ??$$$ newer code — each edge stores neighborPin = the pin on the DESTINATION side.
  // e.g. wire "mcu.D13 -> resistor.1":
  //   forward edge  mcu->resistor: neighborPin = "1"   (resistor's pin)
  //   backward edge resistor->mcu: neighborPin = "D13" (MCU's pin)
  // So when BFS reaches the MCU node, neighborPin IS the MCU GPIO pin.
  const graph = new Map<string, { partKey: string; neighborPin: string }[]>();

  const add = (fromPart: string, toPart: string, toPin: string) => {
    if (!graph.has(fromPart)) graph.set(fromPart, []);
    graph.get(fromPart)!.push({ partKey: toPart, neighborPin: toPin });
  };

  for (const wire of wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);
    if (!from.partKey || !to.partKey) continue;
    add(from.partKey, to.partKey, normalizePin(to.pin));   // forward
    add(to.partKey, from.partKey, normalizePin(from.pin)); // backward
  }

  return graph;
};

const findWiredPin = (
  project: ProjectData,
  matcher: (item: ComponentItem) => boolean
) => {
  // ??$$$ newer code — collect all wiring part keys so we can bridge key mismatches
  // The wiring uses short role keys ("led", "resistor") while BOM items have
  // safeId-ified keys like "red-led-5mm". We resolve by substring matching.
  const allWiringPartKeys = new Set<string>();
  for (const wire of project.wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);
    if (from.partKey) allWiringPartKeys.add(from.partKey);
    if (to.partKey) allWiringPartKeys.add(to.partKey);
  }

  // Build the set of effective keys for the matched BOM items:
  // 1. Use item.key directly (exact match)
  // 2. Also add any wiring part-key that is a substring of item.key, or vice versa
  const matchedBomItems = project.bom.filter(matcher);
  const componentKeys = new Set<string>();
  for (const item of matchedBomItems) {
    const bomKey = String(item.key || '').toLowerCase();
    if (bomKey) componentKeys.add(bomKey);
    // Bridge: if a wiring part-key is a token inside the BOM key (or vice versa), treat as same part
    for (const wiringKey of allWiringPartKeys) {
      if (bomKey.includes(wiringKey) || wiringKey.includes(bomKey)) {
        componentKeys.add(wiringKey);
      }
    }
  }

  const mcuItems = project.bom.filter(isMicrocontrollerComponent);
  const mcuKeys = new Set<string>(['arduino', 'mcu']);
  for (const item of mcuItems) {
    const bomKey = String(item.key || '').toLowerCase();
    if (bomKey) mcuKeys.add(bomKey);
    for (const wiringKey of allWiringPartKeys) {
      if (bomKey.includes(wiringKey) || wiringKey.includes(bomKey)) {
        mcuKeys.add(wiringKey);
      }
    }
  }


  // ??$$$ newer code — fast path: direct single-hop wire, must be a GPIO signal pin
  for (const wire of project.wiring || []) {
    const from = parseEndpoint(wire.from);
    const to = parseEndpoint(wire.to);

    if (componentKeys.has(from.partKey) && mcuKeys.has(to.partKey)) {
      const pin = normalizePin(to.pin);
      if (pin && !POWER_PINS.has(pin)) return pin;
    }
    if (componentKeys.has(to.partKey) && mcuKeys.has(from.partKey)) {
      const pin = normalizePin(from.pin);
      if (pin && !POWER_PINS.has(pin)) return pin;
    }
  }

  // ??$$$ newer code — multi-hop BFS toward MCU.
  // neighborPin = the pin on the DESTINATION node when traversing each edge.
  // When we step onto an MCU node, neighborPin is the exact MCU GPIO pin.
  // Skip power-rail pins so led.K->mcu.GND never masks mcu.D13->resistor->led.
  const graph = buildWiringGraph(project.wiring || []);

  for (const startKey of componentKeys) {
    const visited = new Set<string>([startKey]);
    const queue: string[] = [startKey];

    while (queue.length > 0) {
      const current = queue.shift()!;

      for (const { partKey: next, neighborPin } of graph.get(current) || []) {
        // ??$$$ newer code — always check MCU nodes regardless of visited,
        // because a power-rail edge (led.K->GND) can mark MCU visited BEFORE
        // the signal-path edge (resistor->mcu.D13) is reached, silently skipping it.
        if (mcuKeys.has(next)) {
          if (neighborPin && !POWER_PINS.has(neighborPin)) return neighborPin;
          // Power-rail to MCU — keep searching, do NOT add to visited
          continue;
        }

        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
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
  compiling: boolean; // ??$$$ newer code — distinct compile-phase flag
  compilePhase: string; // ??$$$ newer code — current compile step message
  ledState: boolean;
  buttonPressed: boolean;
  lcdLine1: string;
  lcdLine2: string;
  lcdBacklight: boolean;
  gpioPins: Record<string, boolean>;
  servoAngles: Record<string, number>; // ??$$$ newer code
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
  compiling: false,       // ??$$$ newer code
  compilePhase: '',       // ??$$$ newer code
  ledState: false,
  buttonPressed: false,
  lcdLine1: EMPTY_LCD_LINE,
  lcdLine2: EMPTY_LCD_LINE,
  lcdBacklight: false,
  gpioPins: {},
  servoAngles: {}, // ??$$$ newer code
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
      servoAngles: {}, // ??$$$ newer code
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
        compiling: false,
        compilePhase: '',
        voltage: 0,
        cpuUsage: 0,
        ledState: false,
        lcdLine1: EMPTY_LCD_LINE,
        lcdLine2: EMPTY_LCD_LINE,
        lcdBacklight: false,
        gpioPins: {},
        servoAngles: {} // ??$$$ newer code
      });
      get().addLog('[SYSTEM] Simulation paused', 'system');
      return;
    }

    // ??$$$ newer code — block if already running OR compiling
    if (get().simulationRunning || get().compiling) {
      return;
    }

    const project = normalizeProjectData(get().project);

    simulationEngine.stop();
    simulationEngine.clearListeners();

    // ??$$$ newer code — enter compile phase
    set({ compiling: true, compilePhase: 'Sending sketch to compiler...' });
    get().addLog('[SIM] Starting compilation pipeline...', 'system');

    simulationEngine.onLCDUpdate((line1, line2, backlight) => {
      set({
        lcdLine1: line1,
        lcdLine2: line2,
        lcdBacklight: backlight
      });
    });

    simulationEngine.onGPIOUpdate((pins) => {
      // ??$$$ newer code — debug: dump BOM + wiring + resolved pin on FIRST gpio event only
      if (Object.keys(get().gpioPins).length === 0) {
        const bomDump = project.bom.map((i: any) => `${i.key}[${i.type}]`).join(', ');
        const wiringDump = (project.wiring || []).map((w: any) => `${w.from}->${w.to}`).join(' | ');
        get().addLog(`[DEBUG-BOM] ${bomDump}`, 'system');
        get().addLog(`[DEBUG-WIRING] ${wiringDump}`, 'system');
      }
      const ledPin = (() => {
        try {
          return findWiredPin(project, (item) =>
            matchesComponent(item, (name, type) => type === 'led' || name.includes('led'))
          );
        } catch { return 'ERR'; }
      })();
      const d13Val = pins['D13'];
      if (d13Val !== undefined) {
        get().addLog(`[DEBUG] D13=${d13Val} | resolvedLedPin="${ledPin}" | ledState=${Boolean(pins[ledPin])}`, 'system');
      }
      set({
        gpioPins: pins,
        ledState: resolveLedState(project, pins)
      });
    });

    // ??$$$ newer code — subscribe to servo updates
    simulationEngine.onServoUpdate((pin, angle) => {
      set((state) => ({
        servoAngles: {
          ...state.servoAngles,
          [pin]: angle
        }
      }));
    });

    simulationEngine.onSerial((text) => {
      get().addLog(text, inferLogType(text));
    });

    // ??$$$ newer code — intercept log events to also update compilePhase
    simulationEngine.onLog((text, type) => {
      get().addLog(text, type);
      if (text.includes('Compiling')) {
        set({ compilePhase: 'Compiling Arduino sketch (avr-gcc)...' });
      } else if (text.includes('Linking')) {
        set({ compilePhase: 'Linking firmware binary...' });
      } else if (text.includes('Flashing')) {
        set({ compilePhase: 'Flashing firmware to virtual CPU...' });
      } else if (text.includes('Compiled') || text.includes('running') || text.includes('online')) {
        set({ compilePhase: 'Firmware ready — booting CPU...' });
      }
    });

    try {
      set({ compilePhase: 'Compiling Arduino sketch (avr-gcc)...' });
      await simulationEngine.start(project.sketch || '', project.bom, project.wiring);
      set({
        simulationRunning: true,
        compiling: false,
        compilePhase: '',
        voltage: 5,
        cpuUsage: 14,
        // ??$$$ newer code — do NOT reset LCD here; setup() already wrote via listeners
        buttonPressed: false
      });
      get().addLog('[SIM] CPU core online — sketch executing', 'boot');
    } catch (error: any) {
      simulationEngine.stop();
      simulationEngine.clearListeners();
      set({
        simulationRunning: false,
        compiling: false,
        compilePhase: '',
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
      compiling: false,       // ??$$$ newer code
      compilePhase: '',       // ??$$$ newer code
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState,
      lcdLine1: EMPTY_LCD_LINE,
      lcdLine2: EMPTY_LCD_LINE,
      lcdBacklight: false,
      gpioPins: {},
      servoAngles: {}, // ??$$$ newer code
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
