// ??$$$ newer code - GPIOBus implementation for Behavior simulation
type PinValue = boolean | number; // boolean for digital, 0-255 for DAC/PWM
type PinListener = (value: PinValue) => void;

export class GPIOBus {
  private listeners = new Map<string, Set<PinListener>>();
  private state = new Map<string, PinValue>();

  write(pin: string, value: PinValue) {
    this.state.set(pin, value);
    const pinListeners = this.listeners.get(pin);
    if (pinListeners) {
      for (const listener of pinListeners) {
        listener(value);
      }
    }
  }

  read(pin: string): PinValue {
    return this.state.get(pin) ?? false;
  }

  on(pin: string, listener: PinListener) {
    if (!this.listeners.has(pin)) {
      this.listeners.set(pin, new Set());
    }
    this.listeners.get(pin)!.add(listener);
    return () => this.listeners.get(pin)?.delete(listener);
  }

  reset() {
    this.state.clear();
    this.listeners.clear();
  }
}

export const gpioBus = new GPIOBus();
