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
  RefreshCw,
  Lightbulb,
  Radio,
  Activity
} from 'lucide-react';
// ??$$$ newer code
import { deriveManifest, bundleToManifest } from '../../simulation/behavior/SimulationManifest';
import type { SimulationManifest } from '../../simulation/behavior/SimulationManifest';
import { BehaviorConductor } from '../../simulation/behavior/BehaviorConductor';
import { VirtualFSPeripheral } from '../../simulation/behavior/peripherals/VirtualFSPeripheral';
import { drawOLED } from '../../simulation/behavior/peripherals/OLEDPeripheral';
// ??$$$ newer code
import type { SimState } from '../../simulation/behavior/SimState';
import { gpioBus } from '../../simulation/behavior/GPIOBus';
// ??$$$ newer code
import { io } from 'socket.io-client';


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

  // ??$$$ newer code - MCU static pins list for physical mapping
  const mcuLeftPins = [
    '5V', 'GND', '3V3', 'EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33', 'GPIO25', 'GPIO26', 'GPIO27', 'GPIO14', 'GPIO12'
  ];
  const mcuRightPins = [
    'GND', 'GPIO23', 'GPIO22', 'TXD', 'RXD', 'GPIO21', 'GPIO19', 'GPIO18', 'GPIO5', 'GPIO17', 'GPIO16', 'GPIO4', 'GPIO0', 'GPIO2', 'GPIO15'
  ];

  const getPeripheralPins = (type: string, sensorType?: string) => {
    if (type === 'SSD1306Canvas') return ['GND', 'VCC', 'SCL', 'SDA'];
    if (type === 'WebAudioOut') return ['GND', 'VCC', 'SIG'];
    if (type === 'VirtualFS') return ['GND', 'VCC', 'MISO', 'MOSI', 'SCK', 'CS'];
    if (type === 'LEDIndicator') return ['ANODE', 'CATHODE'];
    if (type === 'ClickButton') return ['PIN_A', 'PIN_B'];
    if (type === 'SensorInput') {
      if (sensorType === 'DHT22') return ['GND', 'VCC', 'DATA'];
      if (sensorType === 'Distance') return ['GND', 'VCC', 'TRIG', 'ECHO'];
      return ['GND', 'VCC', 'SIG'];
    }
    return ['GND', 'VCC', 'SIG'];
  };

  const physicalPeripherals = useMemo(() => {
    if (!manifest) return [];
    return manifest.peripherals.filter(p => p.type !== 'SerialMonitor');
  }, [manifest]);

  const getPinCoords = (wirePin: string) => {
    const parts = wirePin.split('.');
    if (parts.length < 2) return null;
    const key = parts[0];
    const pinName = parts[1];

    if (key === 'mcu') {
      const leftIdx = mcuLeftPins.indexOf(pinName);
      if (leftIdx !== -1) {
        return { x: 30, y: 175 + leftIdx * 14 };
      }
      const rightIdx = mcuRightPins.indexOf(pinName);
      if (rightIdx !== -1) {
        return { x: 150, y: 175 + rightIdx * 14 };
      }
      return { x: 150, y: 190 };
    } else {
      const pIdx = physicalPeripherals.findIndex(p => p.key === key);
      if (pIdx === -1) return null;
      const p = physicalPeripherals[pIdx];
      const pPins = getPeripheralPins(p.type, p.config.sensorType);
      let pinIdx = pPins.indexOf(pinName);
      if (pinIdx === -1) pinIdx = 0;

      const y_card = 20 + pIdx * 125;
      return { x: 330, y: y_card + 35 + pinIdx * 14 };
    }
  };

  const boardHeight = useMemo(() => {
    return Math.max(500, 40 + physicalPeripherals.length * 125);
  }, [physicalPeripherals]);

  const renderedWires = useMemo(() => {
    if (!rawProject?.wiring || !manifest) return [];
    return (rawProject.wiring as any[]).map((w, idx) => {
      const fromCoord = getPinCoords(w.from);
      const toCoord = getPinCoords(w.to);
      if (!fromCoord || !toCoord) return null;

      // Determine color
      let color = '#10b981'; // green default
      const fUpper = String(w.from || '').toUpperCase();
      const tUpper = String(w.to || '').toUpperCase();
      if (fUpper.includes('VCC') || fUpper.includes('5V') || fUpper.includes('3V3') ||
          tUpper.includes('VCC') || tUpper.includes('5V') || tUpper.includes('3V3')) {
        color = '#ef4444'; // red for power
      } else if (fUpper.includes('GND') || fUpper.includes('CATHODE') || fUpper.includes('PIN_B') ||
                 tUpper.includes('GND') || tUpper.includes('CATHODE') || tUpper.includes('PIN_B')) {
        color = '#3b82f6'; // blue for ground/reference
      } else if (fUpper.includes('SDA') || tUpper.includes('SDA')) {
        color = '#f59e0b'; // amber
      } else if (fUpper.includes('SCL') || tUpper.includes('SCL')) {
        color = '#eab308'; // yellow
      } else if (fUpper.includes('TX') || tUpper.includes('TX') || fUpper.includes('RX') || tUpper.includes('RX')) {
        color = '#a855f7'; // purple
      }

      const dx = Math.abs(toCoord.x - fromCoord.x);
      const c1x = fromCoord.x + dx * 0.4;
      const c2x = toCoord.x - dx * 0.4;
      
      const d = `M ${fromCoord.x} ${fromCoord.y} C ${c1x} ${fromCoord.y}, ${c2x} ${toCoord.y}, ${toCoord.x} ${toCoord.y}`;
      return { id: idx, d, color };
    }).filter(Boolean);
  }, [rawProject?.wiring, physicalPeripherals]);

  // ??$$$ newer code - handle sensor value changes and run conversion calculations
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
            const valKey = p.config.sensorType === 'Photoresistor' ? 'Light'
              : p.config.sensorType === 'Distance' ? 'Distance'
              : p.config.sensorType === 'Motion' ? 'Motion'
              : p.config.sensorType === 'Soil Moisture' ? 'Moisture'
              : p.config.sensorType === 'Gas' ? 'Gas'
              : 'Value';
            newSensorValues[p.config.label || p.key] = sParams[valKey] ?? p.config.defaultValue ?? 512;
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
        } else if (sensorPeripheral.config.sensorType === 'Distance') {
          const distVal = value;
          const travelTimeUs = Number((distVal * 58).toFixed(0));
          const alert = distVal < 10 ? ' - !!! OBJECT VERY NEAR !!!' : '';
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] Ultrasonic read: Dist=${distVal} cm | Echo Duration=${travelTimeUs} μs${alert}`
            }
          ]);
        } else if (sensorPeripheral.config.sensorType === 'Motion') {
          const isMov = value;
          const status = isMov === 1 ? 'ACTIVE - MOTION DETECTED!' : 'QUIET - NO MOTION';
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] PIR read: Signal=${isMov} | State=${status}`
            }
          ]);
        } else if (sensorPeripheral.config.sensorType === 'Soil Moisture') {
          const moistVal = value;
          const status = moistVal < 30 ? 'DRY / NEEDS WATERING!' : moistVal > 80 ? 'WET / SATURATED' : 'GOOD MOISTURE';
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] Soil Moisture: ${moistVal}% | Condition=${status}`
            }
          ]);
        } else if (sensorPeripheral.config.sensorType === 'Gas') {
          const ppm = value;
          const status = ppm > 400 ? 'ALERT - MQ GAS SENSOR DETECTED AIR CONTAMINATION!' : 'CLEAN AIR';
          setSerialLines((prevLines) => [
            ...prevLines.slice(-199),
            {
              id: Date.now() + Math.random(),
              text: `[CALCULATION] MQ Gas read: Level=${ppm} ppm | Status=${status}`
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

  // ??$$$ newer code - send protocol interactions onto the GPIOBus
  const handleBluetoothSend = (value: string) => {
    setSerialLines((prev) => [
      ...prev.slice(-199),
      { id: Date.now() + Math.random(), text: `[BLE RX] Received: "${value}"` }
    ]);
    gpioBus.write('serial_bt', value);
  };

  const handleWiFiRouteClick = (route: string) => {
    setSerialLines((prev) => [
      ...prev.slice(-199),
      { id: Date.now() + Math.random(), text: `[HTTP GET] Request: ${route}` }
    ]);
    gpioBus.write('wifi', route);
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



    // ??$$$ newer code
    const loadBundleData = async (bundle: any) => {
      if (!active) return;

      // Store bundle on rawProject for file viewer passthrough
      setRawProject(bundle.raw);

      // Convert bundle to manifest — zero classification in frontend
      const derived = bundleToManifest(bundle);
      setManifest(derived);
      setBatteryPct(100);

      const addSerialLine = (text: string) => {
        setSerialLines((prev) => [...prev.slice(-199), { id: Date.now() + Math.random(), text }]);
      };

      // Surface validation warnings in serial console immediately
      if (bundle.validation && bundle.validation.warnings && bundle.validation.warnings.length > 0) {
        for (const warning of bundle.validation.warnings) {
          addSerialLine(`[WARN] ${warning.message}`);
        }
      }
      if (bundle.validation && bundle.validation.errors && bundle.validation.errors.length > 0) {
        for (const error of bundle.validation.errors) {
          addSerialLine(`[ERROR] ${error.message}`);
        }
      }

      // Route to correct simulation mode
      if (bundle.simulationMode === 'avr-hardware') {
        // Load hardware sim (3D + avr8js)
        addSerialLine(`[SYSTEM] AVR hardware simulation mode — ${bundle.mcu.displayName}`);
      } else {
        // Behavior sim (current BehaviorConductor path)
        addSerialLine(`[SYSTEM] Behavior simulation mode — ${bundle.simulationModeReason}`);
      }

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
          } else if (p.config.sensorType === 'Distance') {
            initialSensors[p.key] = { Distance: 100 };
            sensorStateValues[p.config.label || p.key] = 100;
          } else if (p.config.sensorType === 'Motion') {
            initialSensors[p.key] = { Motion: 0 };
            sensorStateValues[p.config.label || p.key] = 0;
          } else if (p.config.sensorType === 'Soil Moisture') {
            initialSensors[p.key] = { Moisture: 45 };
            sensorStateValues[p.config.label || p.key] = 45;
          } else if (p.config.sensorType === 'Gas') {
            initialSensors[p.key] = { Gas: 150 };
            sensorStateValues[p.config.label || p.key] = 150;
          } else {
            initialSensors[p.key] = { Value: 512 };
            sensorStateValues[p.config.label || p.key] = 512;
          }
        }
      }
      setSensorInputs(initialSensors);

      // Stop existing conductor if any
      if (conductorRef.current) {
        conductorRef.current.stop();
        conductorRef.current = null;
      }
      if (pinMonitorInterval) {
        clearInterval(pinMonitorInterval);
      }

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
          monitoredPins(monitored);
        }, 250);
      }

      setLoading(false);
    };

    const monitoredPins = (monitored: { pin: string; val: any }[]) => {
      setSensorValues(monitored);
    };

    const fetchSessionData = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/new-flow/virtual-project/${sessionId}`);
        if (!res.ok) throw new Error('Failed to load simulation bundle');
        const { bundle } = await res.json();
        await loadBundleData(bundle);
      } catch (err: any) {
        console.error(err);
        if (active) {
          setError(err.message || 'Failed to initialize simulator.');
          setLoading(false);
        }
      }
    };

    fetchSessionData();

    // Setup Socket.io connection and listeners
    const socketUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '') || 'http://localhost:5000';
    let socket: any = null;
    try {
      socket = io(socketUrl, { withCredentials: true });
      socket.emit("join", sessionId);
      socket.on("simulation_bundle_update", (data: any) => {
        if (data?.bundle && active) {
          console.log("[BehaviorPlayground] Received updated simulation bundle via Socket.io:", data.bundle);
          loadBundleData(data.bundle).catch(console.error);
        }
      });
    } catch (e) {
      console.warn("[BehaviorPlayground] Socket.io client setup failed:", e);
    }

    return () => {
      active = false;
      if (pinMonitorInterval) {
        clearInterval(pinMonitorInterval);
      }
      if (conductorRef.current) {
        conductorRef.current.stop();
        conductorRef.current = null;
      }
      if (socket) {
        socket.disconnect();
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
                                   : sensor.config.sensorType === 'Distance' ? 'Distance'
                                   : sensor.config.sensorType === 'Motion' ? 'PIR Motion Detector'
                                   : sensor.config.sensorType === 'Soil Moisture' ? 'Soil Moisture'
                                   : sensor.config.sensorType === 'Gas' ? 'Gas Level'
                                   : 'Analog Pin'}
                                </span>
                                <span className="text-zinc-350">
                                  {sensor.config.sensorType === 'Potentiometer'
                                    ? `${sensorState['Value'] ?? 512} (${((sensorState['Value'] ?? 512) / 1023 * 3.3).toFixed(1)}V)`
                                    : sensor.config.sensorType === 'Photoresistor'
                                    ? `${sensorState['Light'] ?? 600} lx`
                                    : sensor.config.sensorType === 'Distance'
                                    ? `${sensorState['Distance'] ?? 100} cm`
                                    : sensor.config.sensorType === 'Motion'
                                    ? (sensorState['Motion'] === 1 ? 'DETECTED' : 'QUIET')
                                    : sensor.config.sensorType === 'Soil Moisture'
                                    ? `${sensorState['Moisture'] ?? 45}%`
                                    : sensor.config.sensorType === 'Gas'
                                    ? `${sensorState['Gas'] ?? 150} ppm`
                                    : sensorState['Value'] ?? 512}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={sensor.config.min}
                                max={sensor.config.max}
                                step={sensor.config.sensorType === 'Motion' ? '1' : '1'}
                                value={
                                  sensor.config.sensorType === 'Photoresistor' ? (sensorState['Light'] ?? 600)
                                  : sensor.config.sensorType === 'Distance' ? (sensorState['Distance'] ?? 100)
                                  : sensor.config.sensorType === 'Motion' ? (sensorState['Motion'] ?? 0)
                                  : sensor.config.sensorType === 'Soil Moisture' ? (sensorState['Moisture'] ?? 45)
                                  : sensor.config.sensorType === 'Gas' ? (sensorState['Gas'] ?? 150)
                                  : (sensorState['Value'] ?? 512)
                                }
                                onChange={(e) => {
                                  const valName = sensor.config.sensorType === 'Photoresistor' ? 'Light'
                                    : sensor.config.sensorType === 'Distance' ? 'Distance'
                                    : sensor.config.sensorType === 'Motion' ? 'Motion'
                                    : sensor.config.sensorType === 'Soil Moisture' ? 'Moisture'
                                    : sensor.config.sensorType === 'Gas' ? 'Gas'
                                    : 'Value';
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

                  {/* ??$$$ newer code - Render protocol simulation drivers inside environment sidebar */}
                  {manifest.drivers && manifest.drivers.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-[#2d2d2d] mt-4">
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Protocol Interfaces</div>
                      {manifest.drivers.map((driver) => (
                        <div key={driver.componentKey} className="space-y-3 p-2.5 rounded border border-[#3c3c3c] bg-[#1e1e1e]">
                          <div className="font-mono text-[10px] text-[#007acc] font-bold">
                            {driver.componentKey === 'serial_bt' ? '🔵 Bluetooth Terminal'
                             : driver.componentKey === 'wifi' ? '🌐 WiFi Router'
                             : `🔌 ${driver.componentKey}`}
                          </div>

                          {driver.inputs.map((input, idx) => {
                            if (input.type === 'text_input') {
                              return (
                                <div key={idx} className="space-y-1.5">
                                  <div className="text-[9px] text-zinc-500">{input.label}</div>
                                  <div className="flex gap-2">
                                    <input
                                      id={`driver-input-${driver.componentKey}-${idx}`}
                                      type="text"
                                      placeholder="Type command..."
                                      className="flex-1 bg-[#252526] border border-[#3c3c3c] rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[#007acc] font-mono"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const target = e.currentTarget;
                                          if (target.value.trim()) {
                                            handleBluetoothSend(target.value);
                                            target.value = '';
                                          }
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        const el = document.getElementById(`driver-input-${driver.componentKey}-${idx}`) as HTMLInputElement;
                                        if (el && el.value.trim()) {
                                          handleBluetoothSend(el.value);
                                          el.value = '';
                                        }
                                      }}
                                      className="bg-[#007acc] hover:bg-[#0062a3] text-white px-2.5 py-1 rounded text-[9px] font-medium transition-colors"
                                    >
                                      Send
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            if (input.type === 'button') {
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleWiFiRouteClick(input.config?.route || '')}
                                  className="w-full bg-[#2a2a2b] hover:bg-[#37373d] text-zinc-350 hover:text-white px-2 py-1.5 rounded text-[10px] font-mono border border-[#3c3c3c] transition-all flex items-center justify-between"
                                >
                                  <span>{input.label}</span>
                                  <span className="text-[8px] bg-[#007acc] text-white px-1.5 py-0.5 rounded font-sans uppercase font-bold font-semibold">Request</span>
                                </button>
                              );
                            }

                            return null;
                          })}
                        </div>
                      ))}
                    </div>
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

                       {/* Split Screen Webview Panel on the Right */}
            <div className="flex-1 min-w-[500px] flex flex-col bg-[#141414] overflow-hidden border-l border-[#2d2d2d]">
              
              {/* Webview Title Bar */}
              <div className="h-9 shrink-0 bg-[#2d2d2d] border-b border-[#1e1e1e] flex items-center justify-between px-3 text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                <span className="flex items-center gap-1.5 text-zinc-350">
                  <Activity className="w-3.5 h-3.5 text-[#007acc]" />
                  Preview: Interactive Wiring Schematic
                </span>
                <span className="text-[#007acc] text-[9px] font-mono">ONLINE</span>
              </div>

              {/* Webview Main Content - Schematic Canvas */}
              <div className="flex-1 overflow-auto bg-[#121214] relative flex items-start justify-center p-6">
                {/* Grid background */}
                <div 
                  className="absolute inset-0 pointer-events-none" 
                  style={{
                    backgroundImage: 'linear-gradient(to right, #1d1d22 1px, transparent 1px), linear-gradient(to bottom, #1d1d22 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                    backgroundColor: '#121214'
                  }}
                />

                {/* Style block for active wires animation */}
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes wireFlow {
                    to {
                      stroke-dashoffset: -20;
                    }
                  }
                  .wire-path-active {
                    stroke-dasharray: 6, 6;
                    animation: wireFlow 1.2s linear infinite;
                  }
                `}} />

                {/* The Board container */}
                <div className="relative shrink-0 select-none" style={{ width: '540px', height: `${boardHeight}px` }}>
                  
                  {/* SVG Wires Layer */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                    {renderedWires.map((wire: any) => (
                      <g key={wire.id}>
                        {/* Glow path */}
                        <path
                          d={wire.d}
                          fill="none"
                          stroke={wire.color}
                          strokeWidth="4"
                          strokeOpacity="0.15"
                        />
                        {/* Main path */}
                        <path
                          d={wire.d}
                          fill="none"
                          stroke={wire.color}
                          strokeWidth="1.8"
                          className="wire-path-active"
                        />
                      </g>
                    ))}
                  </svg>

                  {/* Microcontroller MCU module */}
                  <div 
                    className="absolute bg-[#1e1e1e] border border-[#3c3c3c] rounded shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
                    style={{ left: '30px', top: '140px', width: '120px', height: '260px', zIndex: 10 }}
                  >
                    <div className="h-7 bg-[#2d2d2d] border-b border-[#3c3c3c] flex items-center justify-center font-bold text-[8px] text-zinc-350 uppercase tracking-wide px-1 truncate">
                      {manifest?.mcu || 'ESP32 DEVKIT'}
                    </div>
                    <div className="flex-1 relative py-1.5 flex justify-between">
                      {/* Left pin labels */}
                      <div className="flex flex-col justify-between h-full pl-2 select-none">
                        {mcuLeftPins.map((pin) => (
                          <div key={pin} className="flex items-center gap-1 text-[7px] text-zinc-500 font-mono leading-none h-[14px]">
                            <span className="w-1 h-1 bg-zinc-650 rounded-full shrink-0" style={{ marginLeft: '-11px' }} />
                            <span>{pin}</span>
                          </div>
                        ))}
                      </div>
                      {/* Right pin labels */}
                      <div className="flex flex-col justify-between h-full pr-2 select-none text-right">
                        {mcuRightPins.map((pin) => (
                          <div key={pin} className="flex items-center justify-end gap-1 text-[7px] text-zinc-500 font-mono leading-none h-[14px]">
                            <span>{pin}</span>
                            <span className="w-1 h-1 bg-zinc-650 rounded-full shrink-0" style={{ marginRight: '-11px' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Battery/Power Meter above MCU */}
                  <div 
                    className="absolute bg-[#1e1e1e] border border-[#2d2d2d] rounded-md shadow-md flex flex-col overflow-hidden text-[9px] font-mono text-zinc-400 animate-fade-in"
                    style={{ left: '30px', top: '20px', width: '120px', height: '100px', zIndex: 10 }}
                  >
                    <div className="h-5 bg-[#252526] px-2 flex items-center justify-between border-b border-[#2d2d2d] font-bold text-[8px] uppercase tracking-wider text-zinc-500">
                      <span>POWER IN</span>
                    </div>
                    <div className="flex-1 p-1.5 flex flex-col justify-between bg-[#1a1a1a]">
                      <div className="flex justify-between items-center text-[8px] border-b border-zinc-800 pb-0.5">
                        <span className="text-zinc-500">BATTERY:</span>
                        <span className="text-emerald-400 font-bold">{Math.round(batteryPct)}%</span>
                      </div>
                      <div className="flex justify-between items-center text-[8px] border-b border-zinc-800 pb-0.5">
                        <span className="text-zinc-500">DRAW:</span>
                        <span className="text-white font-bold">{manifest?.powerDrawMa || 80}mA</span>
                      </div>
                      <div className="flex justify-between items-center text-[8px]">
                        <span className="text-zinc-500">RUNTIME:</span>
                        <span className="text-[#007acc] font-bold">{batteryStats.hrs}h {batteryStats.mins}m</span>
                      </div>
                    </div>
                  </div>

                  {/* Peripheral Cards list */}
                  {physicalPeripherals.map((p, idx) => {
                    const y_card = 20 + idx * 125;
                    const pPins = getPeripheralPins(p.type, p.config.sensorType);
                    const sensorState = sensorInputs[p.key] || {};

                    return (
                      <div 
                        key={p.key}
                        className="absolute bg-[#1e1e1e] border border-[#2d2d2d] rounded-md shadow-[0_2px_8px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden transition-all duration-200"
                        style={{ left: '330px', top: `${y_card}px`, width: '180px', height: '110px', zIndex: 10 }}
                      >
                        {/* Header */}
                        <div className="h-5 shrink-0 bg-[#252526] px-2 flex items-center justify-between border-b border-[#2d2d2d] font-bold text-[8px] uppercase tracking-wider text-zinc-400">
                          <span className="truncate max-w-[100px]">{p.type === 'SensorInput' ? (p.config.sensorType || 'Sensor') : p.type}</span>
                          <span className="text-[7px] text-zinc-500 font-mono truncate">{p.key}</span>
                        </div>

                        {/* Content Body with pins drawn on left edge */}
                        <div className="flex-1 flex relative">
                          
                          {/* Left pin pads list */}
                          <div className="w-12 shrink-0 border-r border-[#2d2d2d]/30 flex flex-col justify-center gap-1 pl-1">
                            {pPins.map((pin) => (
                              <div key={pin} className="flex items-center gap-1 text-[7px] text-zinc-500 font-mono leading-none h-[12px]">
                                <span className="w-1 h-1 bg-zinc-650 rounded-full shrink-0" style={{ marginLeft: '-5px' }} />
                                <span className="truncate">{pin}</span>
                              </div>
                            ))}
                          </div>

                          {/* Right main display/control area */}
                          <div className="flex-1 p-1.5 flex flex-col justify-center overflow-hidden">
                            
                            {p.type === 'SSD1306Canvas' && (
                              <div className="relative mx-auto bg-black border border-zinc-800 rounded p-[1px]">
                                <canvas
                                  ref={canvasRef}
                                  width={256}
                                  height={128}
                                  className="bg-[#0a1a0a] rounded-[1px]"
                                  style={{ width: '100px', height: '50px' }}
                                />
                              </div>
                            )}

                            {p.type === 'LEDIndicator' && (() => {
                              const isOn = !!(simState as any).outputStates?.[p.config.label || p.key];
                              const colorMap: Record<string, string> = {
                                red: isOn ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] border-red-400' : 'bg-red-950/80 border-red-900 text-red-500/40',
                                green: isOn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] border-emerald-400' : 'bg-emerald-950/80 border-emerald-900 text-emerald-500/40',
                                blue: isOn ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] border-blue-400' : 'bg-blue-950/80 border-blue-900 text-blue-500/40',
                                yellow: isOn ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] border-yellow-350' : 'bg-yellow-950/80 border-yellow-900 text-yellow-500/40',
                                white: isOn ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] border-zinc-300' : 'bg-zinc-800/80 border-zinc-700 text-zinc-500/40',
                              };
                              const colorClass = colorMap[p.config.color] || colorMap.green;
                              return (
                                <div className="flex-1 flex flex-col items-center justify-center gap-1 select-none">
                                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${colorClass}`}>
                                    <Lightbulb className={`w-3.5 h-3.5 ${isOn ? 'text-white' : 'text-zinc-650'}`} />
                                  </div>
                                  <span className={`text-[7px] font-bold tracking-wider ${isOn ? 'text-emerald-400' : 'text-zinc-650'}`}>
                                    {isOn ? 'ON (3.3V)' : 'OFF (0V)'}
                                  </span>
                                </div>
                              );
                            })()}

                            {p.type === 'ServoMotor' && (() => { // ??$$$ newer code
                              const angle = (simState as any).outputStates?.[p.config.label || p.key] ?? 0;
                              return (
                                <div className="flex-1 flex flex-col items-center justify-center gap-1 select-none">
                                  <div className="relative w-8 h-8 rounded-full border-2 border-zinc-700 bg-zinc-900 flex items-center justify-center transition-all duration-300">
                                    <div 
                                      className="absolute w-1 h-4 bg-[#007acc] origin-bottom rounded-full transition-transform duration-300"
                                      style={{ 
                                        bottom: '50%',
                                        transform: `rotate(${angle}deg)`
                                      }}
                                    />
                                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full z-10" />
                                  </div>
                                  <span className="text-[7px] font-bold tracking-wider text-emerald-400">
                                    ANGLE: {angle}°
                                  </span>
                                </div>
                              );
                            })()}

                            {p.type === 'ClickButton' && (() => {
                              const isPressed = btnActive[p.key];
                              return (
                                <div className="flex-1 flex flex-col items-center justify-center gap-1 select-none">
                                  <button
                                    onMouseDown={() => handleButtonPress(p.key)}
                                    onMouseUp={() => handleButtonRelease(p.key)}
                                    onMouseLeave={() => handleButtonRelease(p.key)}
                                    className={`w-20 rounded border text-[8px] py-1 font-bold transition-all text-zinc-300 ${
                                      isPressed
                                        ? 'bg-[#3c3c3c] border-zinc-600 translate-y-[0.5px] shadow-inner'
                                        : 'bg-[#2d2d2d] border-[#3c3c3c] hover:bg-[#37373d] shadow-[0_1px_2px_rgba(0,0,0,0.4)]'
                                    }`}
                                  >
                                    {isPressed ? 'PRESSED' : 'PRESS'}
                                  </button>
                                  {p.config.keyboardKey && (
                                    <span className="text-[7px] text-zinc-500 font-mono">
                                      Key: <span className="bg-[#2d2d2d] px-1 py-0.5 rounded border border-[#3c3c3c] uppercase font-bold text-[#007acc]">{p.config.keyboardKey}</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}

                            {p.type === 'VirtualFS' && (
                              <div className="flex-1 flex flex-col items-center justify-center gap-1 text-zinc-400">
                                <Folder className="h-5 w-5 text-zinc-550" />
                                <span className="text-[8px] font-mono text-zinc-550 truncate max-w-full text-center">
                                  {files.length} audio tracks
                                </span>
                              </div>
                            )}

                            {p.type === 'WebAudioOut' && (() => {
                              const isPlaying = simState.playing;
                              return (
                                <div className="flex-1 flex flex-col items-center justify-center gap-1 text-zinc-400">
                                  <Volume2 className={`h-5 w-5 ${isPlaying ? 'text-[#007acc] animate-bounce' : 'text-zinc-650'}`} />
                                  <span className="text-[7px] font-mono text-zinc-550">
                                    {isPlaying ? 'DAC AUDIO OUT' : 'SILENT'}
                                  </span>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && p.config.sensorType === 'DHT22' && (
                              <div className="flex-1 flex flex-col gap-1 justify-center">
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>Temp</span>
                                    <span>{(sensorState['Temp'] ?? 24).toFixed(1)}°C</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="-40"
                                    max="80"
                                    step="0.5"
                                    value={sensorState['Temp'] ?? 24}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Temp', parseFloat(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>Humid</span>
                                    <span>{Math.round(sensorState['Humidity'] ?? 50)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={sensorState['Humidity'] ?? 50}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Humidity', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            )}

                            {p.type === 'SensorInput' && p.config.sensorType === 'Distance' && (() => {
                              const distance = sensorState['Distance'] ?? 100;
                              return (
                                <div className="flex-1 flex flex-col gap-0.5 justify-center">
                                  <div className="flex items-center justify-between text-[7px] text-zinc-400 leading-none">
                                    <span className="flex items-center gap-0.5">
                                      <Radio className="w-2.5 h-2.5 text-[#007acc] animate-pulse" />
                                      Distance
                                    </span>
                                    <span className="font-bold text-[#007acc]">{distance} cm</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="2"
                                    max="400"
                                    value={distance}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Distance', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="h-1.5 w-full bg-[#151515] rounded overflow-hidden relative flex items-center mt-0.5 border border-zinc-800/80">
                                    <div
                                      className="h-full bg-[#007acc]/25 border-r border-[#007acc] transition-all duration-75 flex items-center justify-end"
                                      style={{ width: `${Math.min(100, Math.max(5, (distance / 400) * 100))}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && p.config.sensorType === 'Motion' && (() => {
                              const isMov = sensorState['Motion'] ?? 0;
                              return (
                                <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                                  <button
                                    onClick={() => handleSensorValueChange(p.key, 'Motion', isMov === 1 ? 0 : 1)}
                                    className={`w-full rounded border text-[8px] py-1.5 font-bold transition-all ${
                                      isMov === 1
                                        ? 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_6px_rgba(239,68,68,0.2)]'
                                        : 'bg-[#2d2d2d] border-[#3c3c3c] text-zinc-400 hover:bg-[#37373d]'
                                    }`}
                                  >
                                    {isMov === 1 ? 'MOTION ACTIVE' : 'TRIGGER'}
                                  </button>
                                  <span className="text-[7px] text-zinc-550 font-mono uppercase tracking-wide">
                                    {isMov === 1 ? 'Active Alert' : 'No Motion'}
                                  </span>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && p.config.sensorType === 'Potentiometer' && (() => {
                              const val = sensorState['Value'] ?? 512;
                              const angle = Math.round((val / 1023) * 270);
                              return (
                                <div className="flex-1 flex flex-col gap-0.5 justify-center">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>Analog Pot</span>
                                    <span>{val}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1023"
                                    value={val}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Value', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="flex justify-center mt-0.5">
                                    <div
                                      className="w-3.5 h-3.5 rounded-full border border-zinc-600 bg-gradient-to-tr from-zinc-800 to-zinc-700 relative"
                                      style={{ transform: `rotate(${angle - 135}deg)` }}
                                    >
                                      <div className="w-0.5 h-1 bg-[#007acc] absolute top-0 left-1.2 rounded-full" />
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && p.config.sensorType === 'Photoresistor' && (() => {
                              const light = sensorState['Light'] ?? 600;
                              return (
                                <div className="flex-1 flex flex-col gap-1 justify-center">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>LDR Light</span>
                                    <span>{Math.round(light * 1.2)} lx</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1023"
                                    value={light}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Light', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="w-full h-0.5 bg-[#2d2d2d] rounded-full overflow-hidden mt-0.5">
                                    <div className="h-full bg-yellow-400/80" style={{ width: `${(light / 1023) * 100}%` }} />
                                  </div>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && p.config.sensorType === 'Soil Moisture' && (() => {
                              const moist = sensorState['Moisture'] ?? 45;
                              return (
                                <div className="flex-1 flex flex-col gap-1 justify-center">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>Soil Moisture</span>
                                    <span>{moist}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={moist}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Moisture', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="w-full h-0.5 bg-[#2d2d2d] rounded-full overflow-hidden mt-0.5">
                                    <div className="h-full bg-blue-500/80" style={{ width: `${moist}%` }} />
                                  </div>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && p.config.sensorType === 'Gas' && (() => {
                              const gas = sensorState['Gas'] ?? 150;
                              return (
                                <div className="flex-1 flex flex-col gap-1 justify-center">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>Gas Level</span>
                                    <span className={gas > 400 ? 'text-red-400 font-bold animate-pulse' : 'text-zinc-450'}>{gas} ppm</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1000"
                                    value={gas}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Gas', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                  <div className="w-full h-0.5 bg-[#2d2d2d] rounded-full overflow-hidden mt-0.5">
                                    <div
                                      className={`h-full ${gas > 400 ? 'bg-red-500' : 'bg-zinc-550'}`}
                                      style={{ width: `${(gas / 1000) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}

                            {p.type === 'SensorInput' && !['DHT22', 'Distance', 'Motion', 'Potentiometer', 'Photoresistor', 'Soil Moisture', 'Gas'].includes(p.config.sensorType) && (() => {
                              const val = sensorState['Value'] ?? 512;
                              return (
                                <div className="flex-1 flex flex-col gap-1 justify-center">
                                  <div className="flex justify-between text-[7px] text-zinc-400 leading-none">
                                    <span>Analog Pin</span>
                                    <span>{val}</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="1023"
                                    value={val}
                                    onChange={(e) => handleSensorValueChange(p.key, 'Value', parseInt(e.target.value))}
                                    className="w-full accent-[#007acc] h-0.5 bg-[#2d2d2d] rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                              );
                            })()}

                          </div>

                        </div>
                      </div>
                    );
                  })}

                </div>
              </div>
            </div>   </div>

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
