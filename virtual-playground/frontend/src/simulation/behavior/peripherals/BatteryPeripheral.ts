// ??$$$ newer code - BatteryPeripheral simulating charge drainage and voltage outputs
import { gpioBus } from '../GPIOBus';

export class BatteryPeripheral {
  private pct = 100;
  private powerDrawMa: number;
  private capacityMah: number;
  private interval: any = null;
  private listeners = new Set<(pct: number, charging: boolean) => void>();

  constructor(powerDrawMa: number, capacityMah: number) {
    this.powerDrawMa = powerDrawMa;
    this.capacityMah = Math.max(1, capacityMah);
  }

  start() {
    this.stop();
    const drainPerSec = (this.powerDrawMa / this.capacityMah / 3600) * 100;

    this.interval = setInterval(() => {
      this.pct = Math.max(0, this.pct - drainPerSec);
      
      // Calculate voltage equivalent: 4.2V (100%) to 3.2V (0%)
      const voltage = 3.2 + (this.pct / 100) * 1.0;
      gpioBus.write('battery.voltage', Number(voltage.toFixed(2)));
      gpioBus.write('battery.pct', Math.round(this.pct));

      this.notify();
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getBatteryPct() {
    return this.pct;
  }

  isCharging() {
    return false; // For now
  }

  onUpdate(cb: (pct: number, charging: boolean) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) {
      cb(this.pct, false);
    }
  }
}
