// ??$$$ newer code - BehaviorConductor coordinates the lifecycle, peripherals, and bus
import { GPIOBus, gpioBus } from './GPIOBus';
/* old code
import { SimulationManifest } from './SimulationManifest';
*/
// ??$$$ newer code
import type { SimulationManifest } from './SimulationManifest';
import { AudioPeripheral } from './peripherals/AudioPeripheral';
import { VirtualFSPeripheral } from './peripherals/VirtualFSPeripheral';
import { BehaviorButtonPeripheral } from './peripherals/BehaviorButtonPeripheral';
import { BatteryPeripheral } from './peripherals/BatteryPeripheral';
/* old code
import { SimState } from './SimState';
*/
// ??$$$ newer code
import type { SimState } from './SimState';

export class BehaviorConductor {
  private manifest: SimulationManifest;
  private bus: GPIOBus;
  private running = false;
  private serialInterval: any = null;
  private serialIndex = 0;
  private stateChangeInterval: any = null;

  // Peripherals
  public audioPeripheral: AudioPeripheral;
  public virtualFS: VirtualFSPeripheral;
  public buttonPeripheral: BehaviorButtonPeripheral | null = null;
  public batteryPeripheral: BatteryPeripheral | null = null;

  // Ref-based SimState
  private simState: SimState = {
    trackName: '',
    progress: 0,
    volume: 75,
    batteryPct: 100,
    btConnected: false,
    playing: false,
    mode: 'ACTIVE'
  };

  private callbacks: {
    onOLEDUpdate: () => void;
    onBatteryUpdate: (pct: number, charging: boolean) => void;
    onSerialLine: (text: string) => void;
    onStateUpdate: (state: SimState) => void;
  } | null = null;

  constructor(manifest: SimulationManifest, virtualFS: VirtualFSPeripheral) {
    this.manifest = manifest;
    this.bus = gpioBus;
    this.audioPeripheral = new AudioPeripheral();
    this.virtualFS = virtualFS;
  }

  start(callbacks: {
    onOLEDUpdate: () => void;
    onBatteryUpdate: (pct: number, charging: boolean) => void;
    onSerialLine: (text: string) => void;
    onStateUpdate: (state: SimState) => void;
  }) {
    this.running = true;
    this.callbacks = callbacks;
    this.bus.reset();
    this.serialIndex = 0;

    // Reset SimState
    this.simState = {
      trackName: '',
      progress: 0,
      volume: 75,
      batteryPct: 100,
      btConnected: this.manifest.projectName.toLowerCase().includes('bluetooth') || this.manifest.mcu.toLowerCase().includes('esp32'),
      playing: false,
      mode: 'ACTIVE',
      outputStates: {}
    };

    // Initialize all GPIO pins HIGH (INPUT_PULLUP default for buttons)
    for (const peripheral of this.manifest.peripherals) {
      if (peripheral.type === 'ClickButton') {
        const pin = peripheral.config.gpioPin;
        if (pin) this.bus.write(pin, true);
      }
    }

    // Wire up LED peripherals — subscribe to their GPIO pins on the bus
    const outputStates: Record<string, boolean> = {};
    for (const peripheral of this.manifest.peripherals) {
      if (peripheral.type === 'LEDIndicator') {
        const pin = peripheral.config.gpioPin;
        const label = peripheral.config.label || peripheral.key;
        outputStates[label] = false;
        if (pin) {
          this.bus.on(pin, (val) => {
            const isOn = peripheral.config.activeHigh ? val === true || val === 1 : val === false || val === 0;
            const changed = outputStates[label] !== isOn;
            outputStates[label] = isOn;
            if (changed) {
              this.simState.outputStates = { ...outputStates };
              callbacks.onSerialLine(`[OUTPUT] ${label} → ${isOn ? 'ON' : 'OFF'}`);
              callbacks.onStateUpdate({ ...this.simState });
              callbacks.onOLEDUpdate();
            }
          });
        }
      }
    }
    this.simState.outputStates = { ...outputStates };

    // For generic-io: wire buttons to drive LED outputs (1 button → 1 LED toggle)
    if (this.manifest.archetype !== 'audio-device') {
      const buttons = this.manifest.peripherals.filter(p => p.type === 'ClickButton');
      const leds = this.manifest.peripherals.filter(p => p.type === 'LEDIndicator');
      const ledStates = new Map<string, boolean>(); // ledKey -> current state

      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const led = leds[i] || leds[0]; // pair button to LED by index, fallback to first LED
        if (!btn?.config.gpioPin || !led?.config.gpioPin) continue;

        this.bus.on(btn.config.gpioPin, (val) => {
          // Trigger on falling edge (button pressed = LOW)
          if (val === false || val === 0) {
            const current = ledStates.get(led.key) ?? false;
            const next = !current;
            ledStates.set(led.key, next);
            this.bus.write(led.config.gpioPin, next);
          }
        });
      }
    }

    // 1. Instantiate Button Peripheral
    this.buttonPeripheral = new BehaviorButtonPeripheral(this.manifest);

    // 2. Instantiate Battery Peripheral
    const batteryConfig = this.manifest.peripherals.find(p => p.type === 'BatteryGauge');
    const capacityMah = batteryConfig?.config?.capacityMah || this.manifest.batteryCapacityMah || 1000;
    this.batteryPeripheral = new BatteryPeripheral(this.manifest.powerDrawMa, capacityMah);
    
    this.batteryPeripheral.onUpdate((pct, charging) => {
      this.simState.batteryPct = pct;
      callbacks.onBatteryUpdate(pct, charging);
      callbacks.onStateUpdate({ ...this.simState });
      callbacks.onOLEDUpdate();
    });
    this.batteryPeripheral.start();

    // 3. Audio Peripheral setup
    this.audioPeripheral.onPlayStateChange((playing) => {
      this.simState.playing = playing;
      callbacks.onStateUpdate({ ...this.simState });
      callbacks.onOLEDUpdate();
    });
    this.audioPeripheral.onVolumeChange((vol) => {
      this.simState.volume = vol;
      callbacks.onStateUpdate({ ...this.simState });
      callbacks.onOLEDUpdate();
    });
    this.audioPeripheral.onTrackChange((trackName) => {
      this.simState.trackName = trackName;
      callbacks.onStateUpdate({ ...this.simState });
      callbacks.onOLEDUpdate();
    });

    // Subscribing to audio changes loop for progress tracking
    this.stateChangeInterval = setInterval(() => {
      if (this.audioPeripheral.isPlaying()) {
        this.simState.progress = this.audioPeripheral.getProgress();
        callbacks.onStateUpdate({ ...this.simState });
        callbacks.onOLEDUpdate();
      }
    }, 100);

    // Bind GPIO pins with debounce — 50ms guard per button
    const lastTrigger = new Map<string, number>();
    this.audioPeripheral.bindButtonPins(this.manifest, (btnKey) => {
      const now = Date.now();
      const last = lastTrigger.get(btnKey) || 0;
      if (now - last < 50) return; // debounce
      lastTrigger.set(btnKey, now);

      callbacks.onSerialLine(`[INPUT] Button ${btnKey} pressed`);
      
      if (btnKey === 'btnNext' || btnKey === 'btnPrev') {
        const files = this.virtualFS.listFiles();
        if (files.length > 0) {
          let idx = files.indexOf(this.audioPeripheral.getCurrentTrack());
          if (btnKey === 'btnNext') {
            idx = (idx + 1) % files.length;
          } else {
            idx = (idx - 1 + files.length) % files.length;
          }
          const nextTrack = files[idx];
          callbacks.onSerialLine(`[SYSTEM] Cycling to track: ${nextTrack}`);
          this.audioPeripheral.play(nextTrack);
        }
      } else if (btnKey === 'btnPair') {
        this.simState.btConnected = !this.simState.btConnected;
        callbacks.onSerialLine(`[SYSTEM] Bluetooth state toggled: ${this.simState.btConnected ? 'Connected' : 'Disconnected'}`);
        callbacks.onStateUpdate({ ...this.simState });
        callbacks.onOLEDUpdate();
      }
    });

    // 4. VirtualFS callbacks handoff
    this.virtualFS.onFileAdded(async (name, buffer) => {
      callbacks.onSerialLine(`[FS] File uploaded: ${name} (${Math.round(buffer.byteLength / 1024)} KB)`);
      
      await this.audioPeripheral.loadFile(name, buffer);

      // Gap 4: Play automatically if first file and audio archetype
      if (this.running && this.manifest.archetype === 'audio-device' && this.virtualFS.listFiles().length === 1) {
        callbacks.onSerialLine(`[SYSTEM] First audio file detected. Autoplay starting: ${name}`);
        this.audioPeripheral.play(name);
      }
    });

    // Load any files already in VirtualFS
    const existingFiles = this.virtualFS.listFiles();
    for (const file of existingFiles) {
      const buf = this.virtualFS.readFile(file);
      if (buf) {
        this.audioPeripheral.loadFile(file, buf);
      }
    }

    // Serial replay loop
    if (this.manifest.serialBehavior.length > 0) {
      callbacks.onSerialLine(`[SYSTEM] Starting behavior simulation for ${this.manifest.projectName}`);
      this.serialInterval = setInterval(() => {
        if (!this.running) return;
        if (this.serialIndex < this.manifest.serialBehavior.length) {
          callbacks.onSerialLine(this.manifest.serialBehavior[this.serialIndex]);
          this.serialIndex++;
        }
      }, 1500);
    }

    callbacks.onStateUpdate({ ...this.simState });
    callbacks.onOLEDUpdate();

    return this.bus;
  }

  getSimState(): SimState {
    return this.simState;
  }

  stop() {
    this.running = false;
    if (this.serialInterval) {
      clearInterval(this.serialInterval);
      this.serialInterval = null;
    }
    if (this.stateChangeInterval) {
      clearInterval(this.stateChangeInterval);
      this.stateChangeInterval = null;
    }
    if (this.batteryPeripheral) {
      this.batteryPeripheral.stop();
      this.batteryPeripheral = null;
    }
    if (this.buttonPeripheral) {
      this.buttonPeripheral.destroy();
      this.buttonPeripheral = null;
    }
    this.audioPeripheral.destroy();
    this.bus.reset();
  }
}
