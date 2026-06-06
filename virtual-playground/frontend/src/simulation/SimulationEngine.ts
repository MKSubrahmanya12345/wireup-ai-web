import type { ComponentItem, Wiring } from '../types/project';
import { compileSketch } from './compiler';
import { ButtonPeripheral } from './peripherals/ButtonPeripheral';
import { LCDPeripheral } from './peripherals/LCDPeripheral';

type LogType = 'boot' | 'info' | 'input' | 'output' | 'system';
type GPIOListener = (pins: Record<string, boolean>) => void;
type LCDListener = (line1: string, line2: string, backlight: boolean) => void;
type SerialListener = (text: string) => void;
type LogListener = (text: string, type: LogType) => void;

type WorkerMessage =
  | { type: 'ready' }
  | { type: 'gpio'; pins: Record<string, boolean> }
  | { type: 'lcd'; line1: string; line2: string; backlight: boolean }
  | { type: 'serial'; text: string }
  | { type: 'error'; error: string };

export class SimulationEngine {
  private worker: Worker | null = null;
  private lcd: LCDPeripheral | null = null;
  private button: ButtonPeripheral | null = null;
  private lcdUnsubscribe: (() => void) | null = null;
  private lcdListeners = new Set<LCDListener>();
  private gpioListeners = new Set<GPIOListener>();
  private serialListeners = new Set<SerialListener>();
  private logListeners = new Set<LogListener>();

  clearListeners() {
    this.lcdListeners.clear();
    this.gpioListeners.clear();
    this.serialListeners.clear();
    this.logListeners.clear();
  }

  onLCDUpdate(listener: LCDListener) {
    this.lcdListeners.add(listener);
    return () => this.lcdListeners.delete(listener);
  }

  onGPIOUpdate(listener: GPIOListener) {
    this.gpioListeners.add(listener);
    return () => this.gpioListeners.delete(listener);
  }

  onSerial(listener: SerialListener) {
    this.serialListeners.add(listener);
    return () => this.serialListeners.delete(listener);
  }

  onLog(listener: LogListener) {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  async start(sketch: string, bom: ComponentItem[], wiring: Wiring[], fqbn = 'arduino:avr:uno') {
    this.stop();

    // ??$$$ newer code \u2014 emit compile phases as distinct log steps (not per render)
    this.emitLog('[SIM] Compiling sketch for Arduino Uno (avr-gcc)', 'info');
    const hex = await compileSketch(sketch, fqbn);
    this.emitLog('[SIM] Linking firmware binary...', 'info');
    this.emitLog('[SIM] Flashing firmware to virtual CPU...', 'info');

    this.lcd = new LCDPeripheral(wiring, bom);
    this.button = new ButtonPeripheral(wiring, bom);
    this.lcdUnsubscribe = this.lcd.onUpdate((line1, line2, backlight) => {
      for (const listener of this.lcdListeners) {
        listener(line1, line2, backlight);
      }
    });

    const worker = new Worker(new URL('./cpu.worker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const data = event.data;

      if (data.type === 'gpio') {
        for (const listener of this.gpioListeners) {
          listener(data.pins);
        }
        return;
      }

      if (data.type === 'lcd') {
        this.lcd?.applyUpdate(data.line1, data.line2, data.backlight);
        return;
      }

      if (data.type === 'serial') {
        for (const listener of this.serialListeners) {
          listener(data.text);
        }
        return;
      }

      if (data.type === 'error') {
        this.emitLog(`[SIM] ${data.error}`, 'system');
      }
    };

    const ready = new Promise<void>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'ready') {
          worker.removeEventListener('message', handleMessage);
          resolve();
        }

        if (event.data.type === 'error') {
          worker.removeEventListener('message', handleMessage);
          reject(new Error(event.data.error));
        }
      };

      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener('error', handleError);
        reject(event.error || new Error(event.message));
      };

      worker.addEventListener('message', handleMessage);
      worker.addEventListener('error', handleError, { once: true });
    });

    worker.postMessage({
      type: 'start',
      hex,
      buttonPins: this.button ? [this.button.pin] : []
    });

    await ready;
    this.button?.release(worker);
    this.emitLog('[SIM] Compiled and running real sketch', 'boot');
  }

  pressButton() {
    this.button?.press(this.worker);
  }

  releaseButton() {
    this.button?.release(this.worker);
  }

  stop() {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }

    this.lcdUnsubscribe?.();
    this.lcdUnsubscribe = null;
    this.lcd = null;
    this.button = null;
  }

  private emitLog(text: string, type: LogType) {
    for (const listener of this.logListeners) {
      listener(text, type);
    }
  }
}

export const simulationEngine = new SimulationEngine();
