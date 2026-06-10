// ??$$$ newer code - Standalone BehaviorPlayground dashboard component
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  Upload,
  Trash2,
  Terminal,
  Battery,
  ArrowLeft,
  Wifi,
  Cpu,
  Layers,
  Volume2,
  Keyboard,
  FileAudio,
  // ??$$$ newer code
  Folder,
  File,
  Sliders,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Settings,
  RefreshCw
} from 'lucide-react';
/* old code
import { deriveManifest, SimulationManifest } from '../../simulation/behavior/SimulationManifest';
*/
// ??$$$ newer code
import { deriveManifest } from '../../simulation/behavior/SimulationManifest';
import type { SimulationManifest } from '../../simulation/behavior/SimulationManifest';
import { BehaviorConductor } from '../../simulation/behavior/BehaviorConductor';
import { VirtualFSPeripheral } from '../../simulation/behavior/peripherals/VirtualFSPeripheral';
import { drawOLED } from '../../simulation/behavior/peripherals/OLEDPeripheral';
/* old code
import { SimState } from '../../simulation/behavior/SimState';
*/
// ??$$$ newer code
import type { SimState } from '../../simulation/behavior/SimState';
import { gpioBus } from '../../simulation/behavior/GPIOBus';

interface BehaviorPlaygroundProps {
  sessionId: string | null;
  projectId: string | null;
}

export const BehaviorPlayground: React.FC<BehaviorPlaygroundProps> = ({ sessionId, projectId }) => {
  const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const virtualPlaygroundUrl = window.location.origin;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<SimulationManifest | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  // React-based copies of state for layout/display
  const [simState, setSimState] = useState<SimState>({
    trackName: '',
    progress: 0,
    volume: 75,
    batteryPct: 100,
    btConnected: false,
    playing: false,
    mode: 'ACTIVE'
  });

  const [serialLines, setSerialLines] = useState<{ id: number; text: string }[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [batteryPct, setBatteryPct] = useState(100);
  const [sensorValues, setSensorValues] = useState<{ pin: string; val: any }[]>([]);
  const [btnActive, setBtnActive] = useState<Record<string, boolean>>({});

  // ??$$$ newer code
  const [sensorInputs, setSensorInputs] = useState<Record<string, Record<string, number>>>({});
  const [activeFile, setActiveFile] = useState<'sketch.ino' | 'wiring.json' | 'bom.json' | 'manifest.json'>('sketch.ino');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'sensors'>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [rawProject, setRawProject] = useState<any>(null);

  const sensors = useMemo(() => {
    if (!manifest) return [];
    return manifest.peripherals.filter((p: any) => p.type === 'SensorInput');
  }, [manifest]);

  const handleSensorValueChange = (sensorKey: string, parameter: string, value: number) => {
    setSensorInputs((prev) => {
      const updated = {
        ...prev,
        [sensorKey]: {
          ...(prev[sensorKey] || {}),
          [parameter]: value
        }
      };

      // Also compute calculations and update simState/OLED & trigger serial log
      const newSensorValues: Record<string, number> = {};
      Object.entries(updated).forEach(([sKey, sParams]) => {
        const p = manifest?.peripherals.find((item) => item.key === sKey);
        if (p) {
          if (p.config.sensorType === 'DHT22') {
            newSensorValues['Temp'] = sParams['Temp'] ?? 24;
            newSensorValues['Humid'] = sParams['Humidity'] ?? 50;
          } else {
            const valKey = p.config.sensorType === 'Photoresistor' ? 'Light' : 'Value';
            newSensorValues[p.config.label || p.key] = sParams[valKey] ?? 512;
          }
        }
      });

      setSimState((prevSim) => ({
        ...prevSim,
        sensorValues: newSensorValues
      }));

      // Trigger OLED update frame
      setTimeout(() => {
        renderOLEDFrame();
      }, 0);

      // Perform calculations and print to serial monitor
      const sensorPeripheral = manifest?.peripherals.find(p => p.key === sensorKey);
      if (sensorPeripheral) {
        const pin = sensorPeripheral.config.gpioPin;
        // 1. Write the value to the GPIOBus
        if (pin) {
          gpioBus.write(pin, value);
        }

        // 2. Calculations:
        if (sensorPeripheral.config.sensorType === 'DHT22') {
          if (parameter === 'Temp') {
            const celsius = value;
            const fahrenheit = Number((celsius * 9 / 5 + 32).toFixed(1));
            const kelvin = Number((celsius + 273.15).toFixed(1));
            setSerialLines((prevLines) => [
              ...prevLines.slice(-199),
              {
                id: Date.now() + Math.random(),
                text: `[CALCULATION] Temp conversion: ${celsius}°C = ${fahrenheit}°F = ${kelvin}K`
              }
            ]);
          } else if (parameter === 'Humidity') {
            const humidity = value;
            const status = humidity > 70 ? 'WET / DEW' : humidity < 30 ? 'DRY' : 'NORMAL';
            setSerialLines((prevLines) => [
              ...prevLines.slice(-199),
              {
                id: Date.now() + Math.random(),
                text: `[CALCULATION] Humidity check: ${humidity}% - Environment status: ${status}`
              }
            ]);
          }
        } else if (sensorPeripheral.config.sensorType === 'Potentiometer') {
          const analogVal = value;
          const voltage = Number(((analogVal / 1023) * 3.3).toFixed(2));
          const angle = Number(((analogVal / 1023) * 270).toFixed(0)); // 270 degree pot
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] Pot read: ADC=${analogVal} | Voltage=${voltage}V | Angle=${angle}°`
            }
          ]);
        } else if (sensorPeripheral.config.sensorType === 'Photoresistor') {
          const lightVal = value;
          const percentage = Number(((lightVal / 1023) * 100).toFixed(0));
          const lux = Number((lightVal * 1.2).toFixed(0));
          const level = lux < 100 ? 'Dark' : lux < 500 ? 'Dim' : 'Bright';
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] Light read: ADC=${lightVal} (${percentage}%) | Est Lux=${lux} lx | Ambient=${level}`
            }
          ]);
        } else {
          // Generic
          const analogVal = value;
          const percentage = Number(((analogVal / 1023) * 100).toFixed(0));
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] Sensor "${sensorPeripheral.config.label}" updated: Raw=${analogVal} (${percentage}%)`
            }
          ]);
        }
      }

      return updated;
    });
  };

  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const serialEndRef = useRef<HTMLDivElement | null>(null);
  const virtualFSRef = useRef<VirtualFSPeripheral>(new VirtualFSPeripheral());
  const conductorRef = useRef<BehaviorConductor | null>(null);
  const stateRef = useRef<SimState>(simState);

  // Sync state reference to avoid stale closures in intervals
  useEffect(() => {
    stateRef.current = simState;
  }, [simState]);

  // ??$$$ old code
  /*
  // Load project & session data on mount
  useEffect(() => {
    if (!sessionId) {
      setError('No Session ID found in parameters.');
      setLoading(false);
      return;
    }

    let active = true;

    const fetchSessionData = async () => {
      try {
        let rawProject: any = null;

        // Fetch virtual project
        try {
          const res = await fetch(`${apiBaseUrl}/new-flow/virtual-project/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            rawProject = data?.project;
          }
        } catch (e) {
          console.warn('Failed to load virtual-project, falling back', e);
        }

        if (!rawProject) {
          const res = await fetch(`${apiBaseUrl}/playground/project?sessionId=${sessionId}`);
          if (res.ok) {
            rawProject = await res.json();
          }
        }

        if (!rawProject) {
          throw new Error('Project formulation payload not found.');
        }

        // Fetch blueprint
        let blueprint: any = null;
        try {
          const res = await fetch(`${apiBaseUrl}/new-flow/session/${sessionId}`);
          if (res.ok) {
            const session = await res.json();
            blueprint = session?.blueprint;
          }
        } catch (e) {
          console.warn('Failed to load raw session blueprint', e);
        }

        if (!active) return;

        const derived = deriveManifest(rawProject, blueprint);
        setManifest(derived);
        setBatteryPct(100);

        // Instantiate Conductor
        const conductor = new BehaviorConductor(derived, virtualFSRef.current);
        conductorRef.current = conductor;

        // Start Conductor
        const bus = conductor.start({
          onOLEDUpdate: () => {
            renderOLEDFrame();
          },
          onBatteryUpdate: (pct) => {
            setBatteryPct(pct);
          },
          onSerialLine: (text) => {
            setSerialLines((prev) => [...prev.slice(-199), { id: Date.now() + Math.random(), text }]);
          },
          onStateUpdate: (updatedState) => {
            setSimState(updatedState);
          }
        });

        // Track live pin changes for pin monitor (non-audio archetypes)
        if (derived.archetype !== 'audio-device') {
          const interval = setInterval(() => {
            const monitored: { pin: string; val: any }[] = [];
            for (const p of derived.peripherals) {
              for (const pin of p.pins) {
                monitored.push({ pin, val: bus.read(pin) });
              }
            }
            setSensorValues(monitored);
          }, 250);
          return () => clearInterval(interval);
        }

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        if (active) {
          setError(err.message || 'Failed to initialize simulator.');
          setLoading(false);
        }
      }
    };

    fetchSessionData();

    return () => {
      active = false;
      if (conductorRef.current) {
        conductorRef.current.stop();
        conductorRef.current = null;
      }
    };
  }, [sessionId]);
  */

  // ??$$$ newer code
  // Load project & session data on mount and manage conductor lifecycle
  useEffect(() => {
    if (!sessionId) {
      setError('No Session ID found in parameters.');
      setLoading(false);
      return;
    }

    let active = true;
    let pinMonitorInterval: any = null;

    const fetchSessionData = async () => {
      try {
        let rawProject: any = null;

        // Fetch virtual project
        try {
          const res = await fetch(`${apiBaseUrl}/new-flow/virtual-project/${sessionId}`);
          if (res.ok) {
            const data = await res.json();
            rawProject = data?.project;
          }
        } catch (e) {
          console.warn('Failed to load virtual-project, falling back', e);
        }

        if (!rawProject) {
          const res = await fetch(`${apiBaseUrl}/playground/project?sessionId=${sessionId}`);
          if (res.ok) {
            rawProject = await res.json();
          }
        }

        if (!rawProject) {
          throw new Error('Project formulation payload not found.');
        }
        
        // ??$$$ newer code
        setRawProject(rawProject);

        // Fetch blueprint
        let blueprint: any = null;
        try {
          const res = await fetch(`${apiBaseUrl}/new-flow/session/${sessionId}`);
          if (res.ok) {
            const session = await res.json();
            blueprint = session?.blueprint;
          }
        } catch (e) {
          console.warn('Failed to load raw session blueprint', e);
        }

        if (!active) return;

        const derived = deriveManifest(rawProject, blueprint);
        setManifest(derived);
        setBatteryPct(100);

        // ??$$$ newer code
        // Initialize sensor values
        const initialSensors: Record<string, Record<string, number>> = {};
        const sensorStateValues: Record<string, number> = {};
        
        for (const p of derived.peripherals) {
          if (p.type === 'SensorInput') {
            if (p.config.sensorType === 'DHT22') {
              initialSensors[p.key] = { Temp: 24, Humidity: 50 };
              sensorStateValues['Temp'] = 24;
              sensorStateValues['Humid'] = 50;
            } else if (p.config.sensorType === 'Potentiometer') {
              initialSensors[p.key] = { Value: 512 };
              sensorStateValues[p.config.label || p.key] = 512;
            } else if (p.config.sensorType === 'Photoresistor') {
              initialSensors[p.key] = { Light: 600 };
              sensorStateValues[p.config.label || p.key] = 600;
            } else {
              initialSensors[p.key] = { Value: 512 };
              sensorStateValues[p.config.label || p.key] = 512;
            }
          }
        }
        setSensorInputs(initialSensors);

        // Instantiate Conductor
        const conductor = new BehaviorConductor(derived, virtualFSRef.current);
        conductorRef.current = conductor;

        // Start Conductor
        const bus = conductor.start({
          onOLEDUpdate: () => {
            renderOLEDFrame();
          },
          onBatteryUpdate: (pct) => {
            setBatteryPct(pct);
          },
          onSerialLine: (text) => {
            setSerialLines((prev) => [...prev.slice(-199), { id: Date.now() + Math.random(), text }]);
          },
          onStateUpdate: (updatedState) => {
            setSimState((prev) => ({
              ...updatedState,
              sensorValues: Object.keys(sensorStateValues).length > 0 ? sensorStateValues : prev.sensorValues
            }));
          }
        });

        // Initialize state sensorValues
        if (Object.keys(sensorStateValues).length > 0) {
          setSimState((prev) => ({
            ...prev,
            sensorValues: sensorStateValues
          }));
        }

        // Track live pin changes for pin monitor (non-audio archetypes)
        if (derived.archetype !== 'audio-device') {
          pinMonitorInterval = setInterval(() => {
            const monitored: { pin: string; val: any }[] = [];
            for (const p of derived.peripherals) {
              for (const pin of p.pins) {
                monitored.push({ pin, val: bus.read(pin) });
              }
            }
            setSensorValues(monitored);
          }, 250);
        }

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        if (active) {
          setError(err.message || 'Failed to initialize simulator.');
          setLoading(false);
        }
      }
    };

    fetchSessionData();

    return () => {
      active = false;
      if (pinMonitorInterval) {
        clearInterval(pinMonitorInterval);
      }
      if (conductorRef.current) {
        conductorRef.current.stop();
        conductorRef.current = null;
      }
    };
  }, [sessionId]);

  // Keep VirtualFS file list in sync
  useEffect(() => {
    const fs = virtualFSRef.current;
    const unsub = fs.onFilesChanged((list) => {
      setFiles(list);
      renderOLEDFrame();
    });
    return () => {
      // ??$$$ newer code
      unsub();
    };
  }, []);

  // Auto-scroll serial log
  useEffect(() => {
    serialEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serialLines]);

  // Imperative 10fps drawing on canvas to avoid react re-render cycles
  const renderOLEDFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    // 2x scale for 128x64 display
    ctx.scale(2, 2);
    
    const hasFiles = virtualFSRef.current.listFiles().length > 0;
    const arch = manifest?.archetype || 'generic';
    const name = manifest?.projectName || 'Project';

    drawOLED(ctx, stateRef.current, hasFiles, arch, name);
    ctx.restore();
  };

  // Trigger draw when manifest changes
  useEffect(() => {
    renderOLEDFrame();
  }, [manifest]);

  // File uploading handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          virtualFSRef.current.uploadFile(file.name, reader.result, file.type);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          virtualFSRef.current.uploadFile(file.name, reader.result, file.type);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Button interactivity
  const handleButtonPress = (key: string) => {
    setBtnActive((prev) => ({ ...prev, [key]: true }));
    if (conductorRef.current?.buttonPeripheral) {
      conductorRef.current.buttonPeripheral.press(key);
    }
  };

  const handleButtonRelease = (key: string) => {
    setBtnActive((prev) => ({ ...prev, [key]: false }));
    if (conductorRef.current?.buttonPeripheral) {
      conductorRef.current.buttonPeripheral.release(key);
    }
  };

  // Calculate estimated battery hours
  const batteryStats = useMemo(() => {
    if (!manifest) return { hrs: 0, mins: 0 };
    const totalHours = (manifest.batteryCapacityMah * (batteryPct / 100)) / manifest.powerDrawMa;
    const hrs = Math.floor(totalHours);
    const mins = Math.round((totalHours % 1) * 60);
    return { hrs, mins };
  }, [manifest, batteryPct]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0f] text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent mb-4" />
        <p className="text-sm font-semibold tracking-wider font-mono">Initializing Behavior Simulation Engine...</p>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0f] text-red-400 p-6">
        <Cpu className="h-12 w-12 mb-4 text-red-500" />
        <h2 className="text-lg font-bold font-mono">Simulation Boot Failed</h2>
        <p className="text-sm text-slate-500 mt-2 font-mono">{error || 'Unknown error'}</p>
        <button
          onClick={() => window.location.href = `${virtualPlaygroundUrl}/?sessionId=${sessionId}`}
          className="mt-6 flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-5 py-2.5 text-xs font-bold text-slate-200 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to 3D View
        </button>
      </div>
    );
  }
  // ??$$$ newer code
  const getFileContent = () => {
    if (activeFile === 'sketch.ino') {
      return rawProject?.sketch || '';
    }
    if (activeFile === 'wiring.json') {
      return JSON.stringify(rawProject?.wiring || [], null, 2);
    }
    if (activeFile === 'bom.json') {
      return JSON.stringify(rawProject?.bom || [], null, 2);
    }
    if (activeFile === 'manifest.json') {
      return JSON.stringify(manifest, null, 2);
    }
    return '';
  };

  const codeContent = getFileContent();
  const codeLines = codeContent.split('\n');

  return (
    <div className="flex h-screen w-screen flex-col bg-[#1e1e1e] text-[#d4d4d4] font-mono text-xs select-none overflow-hidden antialiased">
      {/* VSCode Titlebar */}
      <div className="h-9 shrink-0 bg-[#2d2d2d] border-b border-[#252526] flex items-center justify-between px-3 text-[11px] text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-bold text-[#007acc] text-xs">
            <Cpu className="w-3.5 h-3.5" />
            <span>WIREUP.AI</span>
          </div>
          <div className="flex gap-3 text-zinc-450 font-sans">
            <span className="hover:text-white cursor-pointer transition-colors">File</span>
            <span className="hover:text-white cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-white cursor-pointer transition-colors">Selection</span>
            <span className="hover:text-white cursor-pointer transition-colors">View</span>
            <span className="hover:text-white cursor-pointer transition-colors font-semibold text-[#007acc]">Run Simulation</span>
          </div>
        </div>
        <div className="truncate text-zinc-400 select-none max-w-[400px]">
          {manifest.projectName} — {activeFile} — Wireup IDE
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (conductorRef.current) {
                conductorRef.current.stop();
              }
              window.location.href = `${virtualPlaygroundUrl}/?sessionId=${sessionId}${projectId ? `&projectId=${projectId}` : ''}`;
            }}
            className="flex items-center gap-1.5 rounded bg-[#333333] hover:bg-[#444444] border border-[#444444] hover:text-white px-2 py-0.5 text-[10px] font-sans font-bold text-zinc-300 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to 3D View
          </button>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-red-500/80 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-yellow-500/80 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-zinc-700 hover:bg-green-500/80 cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Activity Bar (VSCode Left Rail) */}
        <div className="w-12 shrink-0 bg-[#333333] border-r border-[#252526] flex flex-col justify-between items-center py-2">
          <div className="flex flex-col gap-4 w-full items-center">
            {/* Explorer button */}
            <button
              onClick={() => {
                setSidebarOpen(true);
                setActiveSidebarTab('explorer');
              }}
              className={`relative p-2 rounded text-zinc-450 hover:text-white transition-colors ${
                sidebarOpen && activeSidebarTab === 'explorer' ? 'text-white bg-[#252526]' : ''
              }`}
            >
              <Folder className="w-5 h-5" />
              {sidebarOpen && activeSidebarTab === 'explorer' && (
                <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
              )}
            </button>

            {/* Sensors button */}
            <button
              onClick={() => {
                setSidebarOpen(true);
                setActiveSidebarTab('sensors');
              }}
              className={`relative p-2 rounded text-zinc-450 hover:text-white transition-colors ${
                sidebarOpen && activeSidebarTab === 'sensors' ? 'text-white bg-[#252526]' : ''
              }`}
            >
              <Sliders className="w-5 h-5" />
              {sidebarOpen && activeSidebarTab === 'sensors' && (
                <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-[#007acc]" />
              )}
            </button>

            {/* Terminal toggle button */}
            <button
              onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
              className={`p-2 rounded text-zinc-450 hover:text-white transition-colors ${
                bottomPanelOpen ? 'text-[#007acc]' : ''
              }`}
            >
              <Terminal className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-zinc-500 hover:text-white"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VSCode Sidebar */}
        {sidebarOpen && (
          <div className="w-60 shrink-0 bg-[#252526] border-r border-[#2d2d2d] flex flex-col overflow-hidden text-zinc-400">
            {activeSidebarTab === 'explorer' ? (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="h-9 flex items-center justify-between px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d]">
                  <span>Explorer: Workspace</span>
                </div>
                
                {/* File Explorer Tree */}
                <div className="flex-1 overflow-y-auto py-2">
                  <div className="px-2 flex items-center gap-1 text-[11px] font-bold text-zinc-350">
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                    <span>wireup-project</span>
                  </div>
                  <div className="pl-6 pr-2 py-0.5 space-y-0.5 mt-1">
                    {[
                      { name: 'sketch.ino', key: 'sketch.ino' },
                      { name: 'wiring.json', key: 'wiring.json' },
                      { name: 'bom.json', key: 'bom.json' },
                      { name: 'manifest.json', key: 'manifest.json' }
                    ].map((f) => (
                      <div
                        key={f.key}
                        onClick={() => setActiveFile(f.key as any)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                          activeFile === f.key
                            ? 'bg-[#37373d] text-white font-semibold'
                            : 'hover:bg-[#2a2a2b] text-zinc-400'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Virtual SD Card storage in Explorer */}
                  {manifest.archetype === 'audio-device' && (
                    <div className="mt-4">
                      <div className="px-2 flex items-center gap-1 text-[11px] font-bold text-zinc-350 border-t border-[#2d2d2d] pt-3">
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        <span>SD Card Storage</span>
                      </div>
                      
                      <div className="px-3 py-2 space-y-3">
                        <div
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                          className="border border-dashed border-[#3c3c3c] rounded bg-[#1e1e1e] p-3 text-center flex flex-col items-center justify-center gap-1.5 hover:border-zinc-550 transition-colors"
                        >
                          <Upload className="h-4 w-4 text-zinc-500" />
                          <div className="text-[9px] text-zinc-400">Drag files here</div>
                          <label className="mt-1 cursor-pointer rounded bg-[#333333] hover:bg-[#444444] px-2 py-1 text-[9px] text-zinc-300 border border-[#444444] transition-all">
                            Browse
                            <input
                              type="file"
                              multiple
                              accept="audio/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <div className="space-y-1">
                          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Storage Files</div>
                          {files.length === 0 ? (
                            <div className="text-[10px] italic text-zinc-600 py-1 font-mono">Empty storage.</div>
                          ) : (
                            files.map((file) => (
                              <div
                                key={file}
                                className={`flex items-center justify-between p-1.5 rounded text-[10px] font-mono border transition-all ${
                                  simState.trackName === file
                                    ? 'border-[#007acc] bg-[#1e1e24] text-white'
                                    : 'border-transparent bg-transparent text-zinc-400 hover:bg-[#2a2a2b]'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate flex-1">
                                  <FileAudio className={`h-3 w-3 ${simState.trackName === file ? 'text-[#007acc]' : 'text-zinc-600'}`} />
                                  <span className="truncate">{file}</span>
                                </div>
                                <button
                                  onClick={() => virtualFSRef.current.deleteFile(file)}
                                  className="text-zinc-650 hover:text-red-400 p-0.5 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="h-9 flex items-center px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 border-b border-[#2d2d2d]">
                  <span>Environment Simulator</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {sensors.length === 0 ? (
                    <div className="text-[10px] italic text-zinc-600 text-center font-mono py-4">No sensor inputs mapped.</div>
                  ) : (
                    sensors.map((sensor) => {
                      const sensorState = sensorInputs[sensor.key] || {};
                      return (
                        <div key={sensor.key} className="space-y-2.5 p-2.5 rounded border border-[#3c3c3c] bg-[#1e1e1e]">
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="text-[#007acc] font-bold">{sensor.config.label}</span>
                            <span className="text-zinc-600">Pin {sensor.config.gpioPin}</span>
                          </div>
                          
                          {sensor.config.sensorType === 'DHT22' ? (
                            <div className="space-y-2.5">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-zinc-500">Temperature</span>
                                  <span className="text-zinc-350">{(sensorState['Temp'] ?? 24).toFixed(1)}°C</span>
                                </div>
                                <input
                                  type="range"
                                  min="-40"
                                  max="80"
                                  step="0.5"
                                  value={sensorState['Temp'] ?? 24}
                                  onChange={(e) => handleSensorValueChange(sensor.key, 'Temp', parseFloat(e.target.value))}
                                  className="w-full accent-[#007acc] h-1 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-zinc-500">Humidity</span>
                                  <span className="text-zinc-350">{Math.round(sensorState['Humidity'] ?? 50)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={sensorState['Humidity'] ?? 50}
                                  onChange={(e) => handleSensorValueChange(sensor.key, 'Humidity', parseInt(e.target.value))}
                                  className="w-full accent-[#007acc] h-1 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px]">
                                <span className="text-zinc-500">
                                  {sensor.config.sensorType === 'Potentiometer' ? 'Analog Pot'
                                   : sensor.config.sensorType === 'Photoresistor' ? 'Ambient Light'
                                   : 'Analog Pin'}
                                </span>
                                <span className="text-zinc-350">
                                  {sensor.config.sensorType === 'Potentiometer'
                                    ? `${sensorState['Value'] ?? 512} (${((sensorState['Value'] ?? 512) / 1023 * 3.3).toFixed(1)}V)`
                                    : sensor.config.sensorType === 'Photoresistor'
                                    ? `${sensorState['Light'] ?? 600} lx`
                                    : sensorState['Value'] ?? 512}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={sensor.config.min}
                                max={sensor.config.max}
                                value={sensor.config.sensorType === 'Photoresistor' ? (sensorState['Light'] ?? 600) : (sensorState['Value'] ?? 512)}
                                onChange={(e) => {
                                  const valName = sensor.config.sensorType === 'Photoresistor' ? 'Light' : 'Value';
                                  handleSensorValueChange(sensor.key, valName, parseInt(e.target.value));
                                }}
                                className="w-full accent-[#007acc] h-1 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Center Panel (Split Editor & Webview Layout) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#1e1e1e]">
          
          <div className="flex-1 flex overflow-hidden">
            {/* Code Editor view on the Left */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-[#2d2d2d] bg-[#1e1e1e]">
              
              {/* Tabs Bar */}
              <div className="h-9 shrink-0 bg-[#2d2d2d] flex items-center overflow-x-auto border-b border-[#1e1e1e]">
                {[
                  { name: 'sketch.ino', key: 'sketch.ino' },
                  { name: 'wiring.json', key: 'wiring.json' },
                  { name: 'bom.json', key: 'bom.json' },
                  { name: 'manifest.json', key: 'manifest.json' }
                ].map((f) => (
                  <div
                    key={f.key}
                    onClick={() => setActiveFile(f.key as any)}
                    className={`h-full flex items-center gap-2 px-4 border-r border-[#1e1e1e] cursor-pointer text-[11px] transition-colors ${
                      activeFile === f.key
                        ? 'bg-[#1e1e1e] text-white border-t-2 border-[#007acc] font-semibold'
                        : 'bg-[#2d2d2d] text-zinc-500 hover:bg-[#2b2b2b] hover:text-zinc-350'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-zinc-650" />
                    <span>{f.name}</span>
                  </div>
                ))}
              </div>

              {/* Editor Code Text */}
              <div className="flex-1 flex overflow-auto bg-[#1e1e1e] font-mono text-[11px]">
                {/* Line Numbers Gutter */}
                <div className="w-10 select-none text-right pr-3 text-zinc-600 border-r border-[#2d2d2d] bg-[#1e1e1e] py-3 leading-relaxed">
                  {/* ??$$$ newer code */}
                  {codeLines.map((_: any, i: number) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                {/* Code Body */}
                <pre className="flex-1 overflow-visible p-3 pl-4 text-[#d4d4d4] selection:bg-[#264f78] outline-none leading-relaxed select-text">
                  <code>{codeContent}</code>
                </pre>
              </div>

            </div>

            {/* Split Screen Webview Panel on the Right */}
            <div className="w-96 shrink-0 flex flex-col bg-[#181818] overflow-hidden">
              
              {/* Webview Title Bar */}
              <div className="h-9 shrink-0 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-3 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                <span>Preview: Live Hardware Display</span>
                <span className="text-[#007acc] text-[9px] font-mono">ONLINE</span>
              </div>

              {/* Webview Main Content */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 items-center">
                
                {/* Flat OLED display render frame */}
                <div className="w-full flex flex-col items-center p-4 rounded bg-[#1e1e1e] border border-[#2d2d2d]">
                  <div className="w-full flex items-center justify-between text-[10px] text-zinc-500 font-mono mb-2">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      128x64 OLED Panel
                    </span>
                    <span className="text-[9px]">{Math.round(batteryPct)}% BAT</span>
                  </div>

                  <div className="relative p-1 bg-black border border-[#2d2d2d] rounded">
                    {/* 128x64 display scaled 2x */}
                    <canvas
                      ref={canvasRef}
                      width={256}
                      height={128}
                      className="bg-[#0a1a0a]"
                      style={{ width: '256px', height: '128px' }}
                    />
                  </div>
                </div>

                {/* Power Station Profile */}
                <div className="w-full p-3.5 rounded bg-[#1e1e1e] border border-[#2d2d2d] space-y-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Power Metrics</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="p-2 bg-[#181818] rounded border border-[#2d2d2d]">
                      <div className="text-zinc-500">Current Draw</div>
                      <div className="text-white font-bold text-xs mt-0.5">{manifest.powerDrawMa} mA</div>
                    </div>
                    <div className="p-2 bg-[#181818] rounded border border-[#2d2d2d]">
                      <div className="text-zinc-500">Capacity</div>
                      <div className="text-white font-bold text-xs mt-0.5">{manifest.batteryCapacityMah} mAh</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-1 text-[10px] font-mono pt-1 text-zinc-400">
                    <span>Est. Runtime:</span>
                    <span className="text-[#007acc] font-bold">{batteryStats.hrs}h {batteryStats.mins}m</span>
                  </div>
                </div>

                {/* LED output indicators */}
                {manifest.peripherals.filter((p) => p.type === 'LEDIndicator').length > 0 && (
                  <div className="w-full p-3.5 rounded bg-[#1e1e1e] border border-[#2d2d2d] space-y-2">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">GPIO LED Output</div>
                    <div className="flex flex-col gap-2 font-mono">
                      {manifest.peripherals
                        .filter((p) => p.type === 'LEDIndicator')
                        .map((led) => {
                          const isOn = !!(simState as any).outputStates?.[led.config.label || led.key];
                          const colorMap: Record<string, string> = {
                            red: isOn ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]' : 'bg-red-950 border-red-900',
                            green: isOn ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-emerald-950 border-emerald-900',
                            blue: isOn ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.7)]' : 'bg-blue-950 border-blue-900',
                            yellow: isOn ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]' : 'bg-yellow-950 border-yellow-900',
                            white: isOn ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]' : 'bg-zinc-800 border-zinc-700',
                          };
                          const colorClass = colorMap[led.config.color] || colorMap.green;
                          return (
                            <div key={led.key} className="flex items-center justify-between p-1.5 rounded bg-[#181818] border border-[#2d2d2d]">
                              <div className="flex items-center gap-2">
                                <div className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${colorClass}`} />
                                <span className="text-[10px] text-zinc-400">{led.config.label || led.key}</span>
                              </div>
                              <span className={`text-[9px] font-bold ${isOn ? 'text-emerald-400' : 'text-zinc-600'}`}>
                                {isOn ? 'HIGH (3.3V)' : 'LOW (0V)'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Tactile user interactive controls */}
                <div className="w-full p-3.5 rounded bg-[#1e1e1e] border border-[#2d2d2d] space-y-3">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tactile Buttons</div>
                  {manifest.archetype === 'audio-device' ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onMouseDown={() => handleButtonPress('btnPrev')}
                          onMouseUp={() => handleButtonRelease('btnPrev')}
                          onMouseLeave={() => handleButtonRelease('btnPrev')}
                          className={`flex-1 rounded border text-[10px] py-2 font-bold transition-all text-zinc-300 ${
                            btnActive['btnPrev']
                              ? 'bg-[#37373d] border-zinc-650'
                              : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d]'
                          }`}
                        >
                          PREV
                        </button>
                        <button
                          onMouseDown={() => handleButtonPress('btnPlay')}
                          onMouseUp={() => handleButtonRelease('btnPlay')}
                          onMouseLeave={() => handleButtonRelease('btnPlay')}
                          className={`flex-1 rounded border text-[10px] py-2 font-bold transition-all text-zinc-300 ${
                            btnActive['btnPlay']
                              ? 'bg-[#37373d] border-zinc-650'
                              : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d]'
                          }`}
                        >
                          {simState.playing ? 'PAUSE' : 'PLAY'}
                        </button>
                        <button
                          onMouseDown={() => handleButtonPress('btnNext')}
                          onMouseUp={() => handleButtonRelease('btnNext')}
                          onMouseLeave={() => handleButtonRelease('btnNext')}
                          className={`flex-1 rounded border text-[10px] py-2 font-bold transition-all text-zinc-300 ${
                            btnActive['btnNext']
                              ? 'bg-[#37373d] border-zinc-650'
                              : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d]'
                          }`}
                        >
                          NEXT
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onMouseDown={() => handleButtonPress('btnVolDown')}
                          onMouseUp={() => handleButtonRelease('btnVolDown')}
                          onMouseLeave={() => handleButtonRelease('btnVolDown')}
                          className={`flex-1 rounded border text-[10px] py-2 font-bold transition-all text-zinc-300 ${
                            btnActive['btnVolDown']
                              ? 'bg-[#37373d] border-zinc-650'
                              : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d]'
                          }`}
                        >
                          VOL -
                        </button>
                        <button
                          onMouseDown={() => handleButtonPress('btnVolUp')}
                          onMouseUp={() => handleButtonRelease('btnVolUp')}
                          onMouseLeave={() => handleButtonRelease('btnVolUp')}
                          className={`flex-1 rounded border text-[10px] py-2 font-bold transition-all text-zinc-300 ${
                            btnActive['btnVolUp']
                              ? 'bg-[#37373d] border-zinc-650'
                              : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d]'
                          }`}
                        >
                          VOL +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {manifest.peripherals
                        .filter((p) => p.type === 'ClickButton')
                        .slice(0, 6)
                        .map((btn) => (
                          <button
                            key={btn.key}
                            onMouseDown={() => handleButtonPress(btn.key)}
                            onMouseUp={() => handleButtonRelease(btn.key)}
                            onMouseLeave={() => handleButtonRelease(btn.key)}
                            className={`rounded border text-[10px] py-2 font-bold transition-all text-zinc-300 truncate ${
                              btnActive[btn.key]
                                ? 'bg-[#37373d] border-zinc-650'
                                : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d]'
                            }`}
                          >
                            {btn.config.label || btn.key}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Keyboard Reference Mapping */}
                <div className="w-full p-3.5 rounded bg-[#1e1e1e] border border-[#2d2d2d] space-y-2">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Keyboard className="h-3.5 w-3.5 text-zinc-550" />
                    Keyboard Intercept
                  </div>
                  <div className="rounded border border-[#2d2d2d] bg-[#181818] p-2.5 text-[9px] font-mono text-zinc-500 space-y-1">
                    {manifest.peripherals
                      .filter((p) => p.type === 'ClickButton' && p.config.keyboardKey)
                      .map((btn) => (
                        <div key={btn.key} className="flex justify-between items-center">
                          <span>{btn.config.label || btn.key}</span>
                          <span className="text-[#007acc] bg-[#2d2d2d] border border-[#3c3c3c] px-1 rounded font-bold uppercase">{btn.config.keyboardKey}</span>
                        </div>
                      ))}
                    <div className="text-[8px] text-zinc-600 italic mt-1.5 text-center">Focus dashboard workspace to capture keys</div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Bottom Panel (VSCode Terminal/Console) */}
          {bottomPanelOpen && (
            <div className="h-56 shrink-0 bg-[#1e1e1e] border-t border-[#2d2d2d] flex flex-col overflow-hidden">
              {/* Terminal tabs */}
              <div className="h-9 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-4 text-[10px] text-zinc-400">
                <div className="flex gap-4">
                  <span className="text-[#007acc] border-b-2 border-[#007acc] font-semibold pb-1.5 pt-1.5 cursor-pointer">
                    TERMINAL (Serial Console)
                  </span>
                  <span className="hover:text-zinc-200 cursor-pointer pb-1.5 pt-1.5">PROBLEMS</span>
                  <span className="hover:text-zinc-200 cursor-pointer pb-1.5 pt-1.5">OUTPUT</span>
                  <span className="hover:text-zinc-200 cursor-pointer pb-1.5 pt-1.5">DEBUG CONSOLE</span>
                </div>
                <button
                  onClick={() => setSerialLines([])}
                  className="hover:text-white font-bold transition-colors uppercase text-[9px]"
                >
                  Clear Logs
                </button>
              </div>

              {/* Monospace output text */}
              <div className="flex-1 p-3 bg-black text-[#85e89d] font-mono text-[11px] overflow-y-auto space-y-1 leading-normal select-text">
                {serialLines.length === 0 ? (
                  <div className="text-zinc-700 italic select-none">Terminal idle. Serial link is listening on UART_TX...</div>
                ) : (
                  serialLines.map((line) => {
                    const text = line.text || '';
                    let colorClass = 'text-zinc-350';
                    if (text.includes('[SYSTEM]')) colorClass = 'text-[#007acc] font-semibold';
                    else if (text.includes('[CALCULATION]')) colorClass = 'text-amber-400/90';
                    else if (text.includes('[INPUT]')) colorClass = 'text-violet-400';
                    else if (text.includes('[FS]')) colorClass = 'text-emerald-400';
                    return (
                      <div key={line.id} className="whitespace-pre-wrap">
                        <span className="text-zinc-700">[{new Date().toLocaleTimeString()}]</span>{' '}
                        <span className={colorClass}>{text}</span>
                      </div>
                    );
                  })
                )}
                <div ref={serialEndRef} />
              </div>
            </div>
          )}

        </div>

      </div>

      {/* VSCode Blue Status Bar */}
      <div className="h-6 shrink-0 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] font-sans">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            <span>main*</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin-slow" />
            <span>Syncing Live Node</span>
          </div>
          <span>Errors: 0</span>
          <span>Warnings: 0</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Board: {manifest.mcu}</span>
          <span>Battery: {Math.round(batteryPct)}%</span>
          <span>BT: {simState.btConnected ? 'Connected' : 'Disconnected'}</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>Arduino C++</span>
        </div>
      </div>
    </div>
  );
};
