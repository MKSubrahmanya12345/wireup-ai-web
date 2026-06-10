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
  FileAudio
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
    return unsub;
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

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0a0a0f] text-slate-200 font-sans antialiased overflow-hidden select-none">
      {/* 1. Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-900 bg-[#0d0d15] px-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-linear-to-tr from-violet-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-mono text-xs font-bold tracking-widest text-slate-100 uppercase">
            WIREUP<span className="text-indigo-400">.AI</span>
          </span>
          <div className="h-4 w-px bg-zinc-800" />
          <span className="text-xs font-semibold text-slate-350 tracking-wide">{manifest.projectName}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[10px] font-bold text-indigo-400 tracking-wider uppercase font-mono">
            <Cpu className="h-3 w-3" />
            {manifest.mcu}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[10px] font-bold text-violet-400 tracking-wider uppercase font-mono">
            <Layers className="h-3 w-3" />
            {manifest.archetype}
          </span>
          <div className="h-4 w-px bg-zinc-800 mx-1" />
          <button
            onClick={() => {
              if (conductorRef.current) {
                conductorRef.current.stop();
              }
              window.location.href = `${virtualPlaygroundUrl}/?sessionId=${sessionId}${projectId ? `&projectId=${projectId}` : ''}`;
            }}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white px-3.5 py-1.5 text-xs font-bold text-slate-300 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to 3D View
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: VirtualFS or Pin Monitor */}
        {manifest.archetype === 'audio-device' ? (
          <aside className="w-72 border-r border-zinc-900 bg-[#0a0a0f] p-5 flex flex-col gap-4 overflow-hidden">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">SD Card Storage</h3>
              <p className="text-[10px] text-slate-500 font-mono">Upload audio tracks to simulate playback</p>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border border-dashed border-zinc-800 rounded-xl bg-[#0d0d15] p-5 text-center flex flex-col items-center justify-center gap-2 hover:border-zinc-700 transition-colors relative"
            >
              <Upload className="h-6 w-6 text-zinc-500" />
              <div className="text-[11px] text-zinc-400 font-medium">Drop MP3/WAV tracks here</div>
              <label className="mt-1 cursor-pointer rounded-lg bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 text-[10px] font-bold text-slate-300 border border-zinc-800 transition-all">
                Choose Files
                <input
                  type="file"
                  multiple
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Tracks Directory</div>
              {files.length === 0 ? (
                <div className="text-xs italic text-zinc-600 p-2 text-center font-mono">No files uploaded.</div>
              ) : (
                files.map((file) => (
                  <div
                    key={file}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono transition-all ${
                      simState.trackName === file
                        ? 'border-indigo-500/40 bg-indigo-500/5 text-indigo-300'
                        : 'border-zinc-900 bg-zinc-950/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <FileAudio className={`h-4 w-4 ${simState.trackName === file ? 'text-indigo-400' : 'text-zinc-650'}`} />
                      <span className="truncate">{file}</span>
                    </div>
                    <button
                      onClick={() => virtualFSRef.current.deleteFile(file)}
                      className="text-zinc-600 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>
        ) : (
          <aside className="w-72 border-r border-zinc-900 bg-[#0a0a0f] p-5 flex flex-col gap-4 overflow-hidden">
            {/* ??$$$ newer code */}
            {/* Environment controls for active sensors */}
            {sensors.length > 0 && (
              <div className="space-y-4 border-b border-zinc-900 pb-4 shrink-0">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Environment Simulator</h3>
                  <p className="text-[10px] text-slate-500 font-mono">Adjust environment values below</p>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {sensors.map((sensor) => {
                    const sensorState = sensorInputs[sensor.key] || {};
                    return (
                      <div key={sensor.key} className="space-y-3 p-3 rounded-lg border border-zinc-900 bg-zinc-950/40">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-indigo-400 font-semibold">{sensor.config.label}</span>
                          <span className="text-[10px] text-zinc-500">Pin: {sensor.config.gpioPin}</span>
                        </div>
                        
                        {sensor.config.sensorType === 'DHT22' ? (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-zinc-400">Temperature</span>
                                <span className="text-indigo-300">{(sensorState['Temp'] ?? 24).toFixed(1)}°C</span>
                              </div>
                              <input
                                type="range"
                                min="-40"
                                max="80"
                                step="0.5"
                                value={sensorState['Temp'] ?? 24}
                                onChange={(e) => handleSensorValueChange(sensor.key, 'Temp', parseFloat(e.target.value))}
                                className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-zinc-400">Humidity</span>
                                <span className="text-indigo-300">{Math.round(sensorState['Humidity'] ?? 50)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={sensorState['Humidity'] ?? 50}
                                onChange={(e) => handleSensorValueChange(sensor.key, 'Humidity', parseInt(e.target.value))}
                                className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-mono">
                              <span className="text-zinc-400">
                                {sensor.config.sensorType === 'Potentiometer' ? 'Rotation / Value'
                                 : sensor.config.sensorType === 'Photoresistor' ? 'Light Level'
                                 : 'Analog Value'}
                              </span>
                              <span className="text-indigo-300">
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
                              className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Sensor Inputs</h3>
              <p className="text-[10px] text-slate-500 font-mono">Live GPIO Pin Bus Monitor</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sensorValues.length === 0 ? (
                <div className="text-xs italic text-zinc-600 p-2 text-center font-mono">No active input lines.</div>
              ) : (
                sensorValues.map((sv, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-900 bg-zinc-950/40 text-xs font-mono"
                  >
                    <span className="text-zinc-400">{sv.pin}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sv.val === false || sv.val === 0
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {typeof sv.val === 'boolean' ? (sv.val ? 'HIGH' : 'LOW') : sv.val}
                    </span>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Center Panel: Device Frame & OLED */}
        <main className="flex-1 bg-[#07070a] p-8 flex flex-col items-center justify-center overflow-y-auto">
          <div className="w-[320px] rounded-3xl bg-[#14141e] border border-zinc-800 p-6 flex flex-col items-center gap-6 shadow-2xl relative">
            
            {/* Battery Indicator on device top */}
            <div className="absolute top-2.5 right-6 flex items-center gap-1">
              <span className="text-[9px] font-mono text-zinc-500 font-semibold">{Math.round(batteryPct)}%</span>
              <div className="w-5 h-2.5 border border-zinc-600 rounded-xs p-px flex items-center">
                <div
                  className="h-full bg-emerald-500 rounded-2xs"
                  style={{ width: `${batteryPct}%` }}
                />
              </div>
            </div>

            {/* OLED Frame */}
            <div className="w-full flex justify-center mt-2">
              <div
                className="relative p-2 rounded-xl bg-zinc-950 border-2 border-zinc-800 shadow-[0_0_25px_rgba(0,255,136,0.06)]"
                style={{ borderRadius: '14px' }}
              >
                {/* 128x64 display scaled 2x */}
                <canvas
                  ref={canvasRef}
                  width={256}
                  height={128}
                  className="rounded-lg bg-[#0a1a0a] shadow-[inset_0_0_10px_rgba(0,255,136,0.2)]"
                  style={{ width: '256px', height: '128px' }}
                />
                {/* CRT Scanline Overlay */}
                <div className="absolute inset-2 pointer-events-none bg-linear-to-b from-transparent via-[#00ff88]/[0.015] to-transparent bg-[size:100%_4px] rounded-lg" />
              </div>
            </div>

            {/* Button Layouts */}
            {manifest.archetype === 'audio-device' ? (
              <div className="w-full flex flex-col gap-3">
                {/* Top Row: Play/Pause/Cycle */}
                <div className="flex justify-between gap-3">
                  <button
                    onMouseDown={() => handleButtonPress('btnPrev')}
                    onMouseUp={() => handleButtonRelease('btnPrev')}
                    onMouseLeave={() => handleButtonRelease('btnPrev')}
                    onTouchStart={() => handleButtonPress('btnPrev')}
                    onTouchEnd={() => handleButtonRelease('btnPrev')}
                    className={`flex-1 rounded-xl p-3 border text-xs font-bold font-mono transition-all text-slate-300 ${
                      btnActive['btnPrev']
                        ? 'bg-zinc-800 border-zinc-700 transform scale-[0.96] shadow-inner'
                        : 'bg-zinc-900 border-zinc-800 shadow-md hover:bg-zinc-850'
                    }`}
                  >
                    PREV
                    <span className="block text-[8px] text-zinc-600 mt-1 font-semibold">◀ key</span>
                  </button>
                  <button
                    onMouseDown={() => handleButtonPress('btnPlay')}
                    onMouseUp={() => handleButtonRelease('btnPlay')}
                    onMouseLeave={() => handleButtonRelease('btnPlay')}
                    onTouchStart={() => handleButtonPress('btnPlay')}
                    onTouchEnd={() => handleButtonRelease('btnPlay')}
                    className={`flex-1 rounded-xl p-3 border text-xs font-bold font-mono transition-all text-slate-200 ${
                      btnActive['btnPlay']
                        ? 'bg-zinc-800 border-zinc-700 transform scale-[0.96] shadow-inner'
                        : 'bg-zinc-900 border-zinc-800 shadow-md hover:bg-zinc-850'
                    }`}
                  >
                    {simState.playing ? 'PAUSE' : 'PLAY'}
                    <span className="block text-[8px] text-zinc-600 mt-1 font-semibold">Space</span>
                  </button>
                  <button
                    onMouseDown={() => handleButtonPress('btnNext')}
                    onMouseUp={() => handleButtonRelease('btnNext')}
                    onMouseLeave={() => handleButtonRelease('btnNext')}
                    onTouchStart={() => handleButtonPress('btnNext')}
                    onTouchEnd={() => handleButtonRelease('btnNext')}
                    className={`flex-1 rounded-xl p-3 border text-xs font-bold font-mono transition-all text-slate-300 ${
                      btnActive['btnNext']
                        ? 'bg-zinc-800 border-zinc-700 transform scale-[0.96] shadow-inner'
                        : 'bg-zinc-900 border-zinc-800 shadow-md hover:bg-zinc-850'
                    }`}
                  >
                    NEXT
                    <span className="block text-[8px] text-zinc-600 mt-1 font-semibold">▶ key</span>
                  </button>
                </div>

                {/* Bottom Row: Volume controls */}
                <div className="flex justify-between gap-3">
                  <button
                    onMouseDown={() => handleButtonPress('btnVolDown')}
                    onMouseUp={() => handleButtonRelease('btnVolDown')}
                    onMouseLeave={() => handleButtonRelease('btnVolDown')}
                    onTouchStart={() => handleButtonPress('btnVolDown')}
                    onTouchEnd={() => handleButtonRelease('btnVolDown')}
                    className={`flex-1 rounded-xl p-3 border text-xs font-bold font-mono transition-all text-slate-350 ${
                      btnActive['btnVolDown']
                        ? 'bg-zinc-850 border-zinc-700 transform scale-[0.96] shadow-inner'
                        : 'bg-[#181825] border-zinc-850 shadow-md hover:bg-zinc-850'
                    }`}
                  >
                    VOL -
                    <span className="block text-[8px] text-zinc-650 mt-1 font-semibold">▼ key</span>
                  </button>
                  <button
                    onMouseDown={() => handleButtonPress('btnVolUp')}
                    onMouseUp={() => handleButtonRelease('btnVolUp')}
                    onMouseLeave={() => handleButtonRelease('btnVolUp')}
                    onTouchStart={() => handleButtonPress('btnVolUp')}
                    onTouchEnd={() => handleButtonRelease('btnVolUp')}
                    className={`flex-1 rounded-xl p-3 border text-xs font-bold font-mono transition-all text-slate-350 ${
                      btnActive['btnVolUp']
                        ? 'bg-zinc-850 border-zinc-700 transform scale-[0.96] shadow-inner'
                        : 'bg-[#181825] border-zinc-850 shadow-md hover:bg-zinc-850'
                    }`}
                  >
                    VOL +
                    <span className="block text-[8px] text-zinc-650 mt-1 font-semibold">▲ key</span>
                  </button>
                </div>

                {/* Side Keys: Power & Bluetooth */}
                <div className="flex justify-between gap-3 border-t border-zinc-800 pt-3">
                  <button
                    onMouseDown={() => handleButtonPress('btnPower')}
                    onMouseUp={() => handleButtonRelease('btnPower')}
                    onMouseLeave={() => handleButtonRelease('btnPower')}
                    onTouchStart={() => handleButtonPress('btnPower')}
                    onTouchEnd={() => handleButtonRelease('btnPower')}
                    className={`flex-1 rounded-lg p-2 border text-[10px] font-bold font-mono transition-all text-slate-400 ${
                      btnActive['btnPower']
                        ? 'bg-zinc-850 border-zinc-750 transform scale-[0.97]'
                        : 'bg-[#14141f] border-zinc-900 hover:bg-zinc-850'
                    }`}
                  >
                    POWER [P]
                  </button>
                  <button
                    onMouseDown={() => handleButtonPress('btnPair')}
                    onMouseUp={() => handleButtonRelease('btnPair')}
                    onMouseLeave={() => handleButtonRelease('btnPair')}
                    onTouchStart={() => handleButtonPress('btnPair')}
                    onTouchEnd={() => handleButtonRelease('btnPair')}
                    className={`flex-1 rounded-lg p-2 border text-[10px] font-bold font-mono transition-all text-slate-400 ${
                      btnActive['btnPair']
                        ? 'bg-zinc-850 border-zinc-750 transform scale-[0.97]'
                        : 'bg-[#14141f] border-zinc-900 hover:bg-zinc-850'
                    }`}
                  >
                    PAIR [B]
                  </button>
                </div>
              </div>
            ) : (
              // Generic layout — buttons + LED indicators
              <div className="w-full flex flex-col gap-3">
                {/* LED output indicators */}
                {manifest.peripherals.filter((p) => p.type === 'LEDIndicator').length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-2 border-b border-zinc-800">
                    {manifest.peripherals
                      .filter((p) => p.type === 'LEDIndicator')
                      .map((led) => {
                        const isOn = !!(simState as any).outputStates?.[led.config.label || led.key];
                        const colorMap: Record<string, string> = {
                          red: isOn ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-red-950 border-red-900',
                          green: isOn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-emerald-950 border-emerald-900',
                          blue: isOn ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-blue-950 border-blue-900',
                          yellow: isOn ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'bg-yellow-950 border-yellow-900',
                          white: isOn ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'bg-zinc-800 border-zinc-700',
                        };
                        const colorClass = colorMap[led.config.color] || colorMap.green;
                        return (
                          <div key={led.key} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border transition-all duration-150 ${colorClass}`} />
                            <span className="text-[10px] font-mono text-zinc-400">{led.config.label || led.key}</span>
                            <span className={`text-[9px] font-bold font-mono ${isOn ? 'text-emerald-400' : 'text-zinc-600'}`}>
                              {isOn ? 'ON' : 'OFF'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
                {/* Button grid */}
                <div className="grid grid-cols-2 gap-3">
                  {manifest.peripherals
                    .filter((p) => p.type === 'ClickButton')
                    .slice(0, 6)
                    .map((btn) => (
                      <button
                        key={btn.key}
                        onMouseDown={() => handleButtonPress(btn.key)}
                        onMouseUp={() => handleButtonRelease(btn.key)}
                        onMouseLeave={() => handleButtonRelease(btn.key)}
                        onTouchStart={() => handleButtonPress(btn.key)}
                        onTouchEnd={() => handleButtonRelease(btn.key)}
                        className={`rounded-xl p-3 border text-xs font-bold font-mono transition-all text-slate-300 truncate ${
                          btnActive[btn.key]
                            ? 'bg-zinc-850 border-zinc-700 transform scale-[0.96] shadow-inner'
                            : 'bg-zinc-900 border-zinc-850 shadow-md hover:bg-zinc-850'
                        }`}
                      >
                        {btn.config.label || btn.key}
                        {btn.config.keyboardKey && (
                          <span className="block text-[8px] text-zinc-600 mt-1 font-semibold font-mono">[{btn.config.keyboardKey}]</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Side: Serial Monitor, Battery, Shortcuts */}
        <aside className="w-80 border-l border-zinc-900 bg-[#0a0a0f] p-5 flex flex-col gap-6 overflow-hidden">
          
          {/* Battery Status */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider font-mono">Power Station</div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 space-y-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">Power Draw</span>
                <span className="font-bold text-slate-300">{manifest.powerDrawMa} mA</span>
              </div>
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-500">Capacity</span>
                <span className="font-bold text-slate-300">{manifest.batteryCapacityMah} mAh</span>
              </div>
              <div className="h-px bg-zinc-900 my-1" />
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-500">Est. Runtime</span>
                  <span className="font-bold text-indigo-400">
                    {batteryStats.hrs} hrs {batteryStats.mins} min
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Serial Monitor */}
          <div className="flex-1 flex flex-col gap-2 overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider font-mono">Serial Monitor</span>
              <button
                onClick={() => setSerialLines([])}
                className="text-[9px] font-bold text-zinc-500 hover:text-slate-300 transition-colors uppercase font-mono"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 rounded-xl border border-zinc-900 bg-zinc-950/80 p-4 font-mono text-[10px] leading-relaxed text-emerald-500/90 overflow-y-auto space-y-1 shadow-inner select-text">
              {serialLines.length === 0 ? (
                <div className="text-zinc-700 italic select-none">Monitor idle. Setup ready...</div>
              ) : (
                serialLines.map((line) => (
                  <div key={line.id} className="whitespace-pre-wrap">
                    <span className="text-zinc-650">[{new Date().toLocaleTimeString()}]</span> {line.text}
                  </div>
                ))
              )}
              <div ref={serialEndRef} />
            </div>
          </div>

          {/* Keyboard Reference */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-zinc-555 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5 text-zinc-600" />
              Keyboard Mapping
            </div>
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-3 text-[10px] font-mono text-zinc-500 space-y-1.5">
              {manifest.peripherals
                .filter((p) => p.type === 'ClickButton' && p.config.keyboardKey)
                .map((btn) => (
                  <div key={btn.key} className="flex justify-between">
                    <span>{btn.config.label || btn.key}</span>
                    <span className="text-slate-350 bg-zinc-900 border border-zinc-850 px-1.5 rounded-xs font-bold uppercase">{btn.config.keyboardKey}</span>
                  </div>
                ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
};
