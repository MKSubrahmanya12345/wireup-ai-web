// ??$$$ non-important
// ??$$$
import { create } from 'zustand';
import type { ProjectData } from '../types/project';
import { projectData } from '../data/project';

/* old code
// ??$$ newer code
let simInterval = null;

const normalizeProjectData = (data: ProjectData): ProjectData => {
  const editableJson = {
    simulationSpeed: 1,
    ledInitialState: false,
    buttonInitialState: false,
    ...(data.editableJson || {})
  };
*/
// ??$$$ newer code
let simInterval: any = null;

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
  // ??$$$ newer code - lcd screen content lines
  lcdLine1: string;
  lcdLine2: string;
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
  // ??$$$ newer code
  lcdLine1: '',
  lcdLine2: '',
  logs: [],
  selectedFile: 'sketch.ino',
  selectedComponent: null,
  showWires: true,
  showLabels: true,
  fps: 60,
  cpuUsage: 0,
  voltage: 0.0,

  setTab: (tab) => set({ currentTab: tab }),

  loadProject: (data) => {
    const normalized = normalizeProjectData(data);
    set({ 
      project: normalized, 
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState
    });
  },

    /* old code
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
  */
  // ??$$ newer code
  setSimulationRunning: (running) => {
    set({ simulationRunning: running });
    
    // Clear any existing simulation loop/interval
    if (simInterval) {
      clearInterval(simInterval);
      simInterval = null;
    }

    if (running) {
      set({ voltage: 5.0, cpuUsage: 12 });
      get().addLog('[BOOT] Arduino initialized', 'boot');
      
      const bom = get().project?.bom || [];
      const hasSoil = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('soil') || String(p.displayName || p.key || '').toLowerCase().includes('moisture'));
      const hasTemp = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('temp') || String(p.displayName || p.key || '').toLowerCase().includes('dht') || String(p.displayName || p.key || '').toLowerCase().includes('humidity'));
      const hasDistance = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('distance') || String(p.displayName || p.key || '').toLowerCase().includes('sr04') || String(p.displayName || p.key || '').toLowerCase().includes('ultrasonic'));
      const hasLdr = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('ldr') || String(p.displayName || p.key || '').toLowerCase().includes('light') || String(p.displayName || p.key || '').toLowerCase().includes('photoresistor'));
      const hasPot = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('pot') || String(p.displayName || p.key || '').toLowerCase().includes('potentiometer'));
      const hasButton = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('button') || String(p.displayName || p.key || '').toLowerCase().includes('switch'));
      const hasLed = bom.some((p) => String(p.displayName || p.key || '').toLowerCase().includes('led'));

      setTimeout(() => {
        if (!get().simulationRunning) return;
        
        if (hasSoil) {
          get().addLog('[SYSTEM] Soil Moisture Sensor online (ADC Channel 0)', 'system');
        } else if (hasTemp) {
          get().addLog('[SYSTEM] DHT22 Temp/Humidity Sensor initialized (Single-Wire)', 'system');
        } else if (hasDistance) {
          get().addLog('[SYSTEM] HC-SR04 Ultrasonic Sensor calibrated (Trigger Pin D5, Echo Pin D6)', 'system');
        } else if (hasButton) {
          get().addLog('[INFO] Waiting for button input', 'info');
        } else {
          get().addLog('[INFO] Waiting for inputs...', 'info');
        }
      }, 800);

      // Start periodic simulator logs
      simInterval = setInterval(() => {
        if (!get().simulationRunning) return;

        const sketch = get().project?.sketch || '';
        const isBlink = sketch.includes('digitalWrite') && (sketch.includes('delay') || sketch.includes('millis'));

        // If the project code is a blink sketch and there's no sensor/button, toggle LED state!
        if (isBlink && hasLed && !hasSoil && !hasTemp && !hasDistance && !hasLdr && !hasPot && !hasButton) {
          set((state) => {
            const nextLed = !state.ledState;
            get().addLog(nextLed ? '[OUTPUT] LED turned ON (Pin D13: HIGH)' : '[OUTPUT] LED turned OFF (Pin D13: LOW)', 'output');
            return { ledState: nextLed };
          });
          return;
        }

        const tempVal = 22.0 + Math.random() * 4.0;
        const humVal = 50 + Math.random() * 15;
        const distVal = 10 + Math.random() * 150;

        if (hasSoil) {
          const moisture = Math.floor(400 + Math.random() * 80);
          const state = moisture > 600 ? "Dry" : (moisture > 300 ? "Optimal" : "Wet");
          get().addLog('[OUTPUT] Soil Moisture: ' + moisture + ' (' + state + ')', 'output');
        }
        if (hasTemp) {
          const temp = tempVal.toFixed(1);
          const hum = humVal.toFixed(0);
          get().addLog('[OUTPUT] Temperature: ' + temp + 'C | Humidity: ' + hum + '%', 'output');
        }
        if (hasDistance) {
          const dist = Math.floor(distVal);
          get().addLog('[OUTPUT] Measured Distance: ' + dist + ' cm', 'output');
        }
        if (hasLdr) {
          const light = Math.floor(200 + Math.random() * 600);
          get().addLog('[OUTPUT] Light Level: ' + light + ' (LDR)', 'output');
        }
        if (hasPot) {
          const val = Math.floor(Math.random() * 1024);
          get().addLog('[OUTPUT] Potentiometer Read: ' + val, 'output');
        }

        // ??$$$ newer code - extract LCD text and update store state
        const lines = ['', ''];
        
        // Pattern 1: static strings — lcd.print("Hello World")
        const staticMatches = [...sketch.matchAll(/lcd\.print\s*\(\s*"([^"]+)"\s*\)/g)];
        if (staticMatches[0]) lines[0] = staticMatches[0][1].slice(0, 16);
        if (staticMatches[1]) lines[1] = staticMatches[1][1].slice(0, 16);
        
        // Pattern 2: sensor display — lcd.print(temp) near known variable
        const hasTempVar = /float\s+temp|int\s+temp/i.test(sketch);
        const hasHumVar = /float\s+hum|int\s+hum/i.test(sketch);
        const hasDist = /distance|dist/i.test(sketch);
        
        if (hasTempVar && lines[0] === '') 
          lines[0] = `Temp: ${tempVal.toFixed(1)}C`;
        if (hasHumVar && lines[1] === '') 
          lines[1] = `Hum: ${humVal.toFixed(0)}%`;
        if (hasDist && lines[0] === '') 
          lines[0] = `Dist: ${Math.floor(distVal)}cm`;
        
        // Pattern 3: lcd.setCursor(0,0) followed by print
        const cursorBlocks = [...sketch.matchAll(
          /lcd\.setCursor\s*\(\s*0\s*,\s*(\d)\s*\)[\s\S]*?lcd\.print\s*\(\s*"([^"]+)"\s*\)/g
        )];
        for (const match of cursorBlocks) {
          const row = parseInt(match[1]);
          if (row === 0) lines[0] = match[2].slice(0, 16);
          if (row === 1) lines[1] = match[2].slice(0, 16);
        }

        // Fallback: If the code has "welcome" or "hello" startup prints, display them
        if (lines[0] === '' && lines[1] === '') {
          if (sketch.includes('lcd.print("')) {
            const firstPrint = sketch.match(/lcd\.print\s*\(\s*"([^"]+)"\s*\)/);
            if (firstPrint) {
              lines[0] = firstPrint[1].slice(0, 16);
            }
          }
        }

        set({ lcdLine1: lines[0], lcdLine2: lines[1] });
      }, 2500);

    } else {
      set({ voltage: 0.0, cpuUsage: 0, lcdLine1: '', lcdLine2: '' });
      get().addLog('[SYSTEM] Simulation paused', 'system');
    }
  },

  setLedState: (state) => set({ ledState: state }),

    /* old code
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
  */
  // ??$$ newer code
  setButtonPressed: (pressed) => {
    const running = get().simulationRunning;
    set({ buttonPressed: pressed });
    
    if (running) {
      // Find where button is wired to (default pin D2)
      // Find where led is wired to (default pin D7 or D13)
      const wiring = get().project?.wiring || [];
      const buttonWire = wiring.find((w) => String(w.from || '').toLowerCase().includes('button') || String(w.to || '').toLowerCase().includes('button'));
      const ledWire = wiring.find((w) => String(w.from || '').toLowerCase().includes('led') || String(w.to || '').toLowerCase().includes('led'));
      
      /* old code
      const getPinId = (wire, key) => {
        if (!wire) return null;
        if (String(wire.from || '').toLowerCase().includes(key)) {
          return String(wire.to || '').split('.')[1] || null;
        }
        return String(wire.from || '').split('.')[1] || null;
      };
      */
      // ??$$$ newer code
      const getPinId = (wire: any, key: string) => {
        if (!wire) return null;
        if (String(wire.from || '').toLowerCase().includes(key)) {
          return String(wire.to || '').split('.')[1] || null;
        }
        return String(wire.from || '').split('.')[1] || null;
      };

      const buttonPin = getPinId(buttonWire, 'button') || 'D2';
      const ledPin = getPinId(ledWire, 'led') || 'D7';

      if (pressed) {
        set({ ledState: true });
        get().addLog('[INPUT] Button pressed (Pin ' + buttonPin + ': HIGH)', 'input');
        get().addLog('[OUTPUT] LED Turn ON (Pin ' + ledPin + ': HIGH)', 'output');
      } else {
        set({ ledState: false });
        get().addLog('[INPUT] Button released (Pin ' + buttonPin + ': LOW)', 'input');
        get().addLog('[OUTPUT] LED Turn OFF (Pin ' + ledPin + ': LOW)', 'output');
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
    const normalized = normalizeProjectData(currentProj);
    set({
      simulationRunning: false,
      ledState: normalized.editableJson.ledInitialState,
      buttonPressed: normalized.editableJson.buttonInitialState,
      voltage: 0.0,
      cpuUsage: 0,
      // ??$$$ newer code
      lcdLine1: '',
      lcdLine2: ''
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
