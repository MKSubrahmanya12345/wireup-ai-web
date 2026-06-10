// ??$$$ newer code - BehaviorButtonPeripheral keyboard and click listener with clean cleanup
import { gpioBus } from '../GPIOBus';
/* old code
import { SimulationManifest } from '../SimulationManifest';
*/
// ??$$$ newer code
import type { SimulationManifest } from '../SimulationManifest';

export class BehaviorButtonPeripheral {
  private manifest: SimulationManifest;
  private keyMap = new Map<string, string>(); // keyboardKey -> gpioPin
  private pinToKey = new Map<string, string>(); // keyboardKey -> btn.key

  constructor(manifest: SimulationManifest) {
    this.manifest = manifest;
    for (const p of manifest.peripherals) {
      if (p.type === 'ClickButton') {
        const keyboardKey = p.config.keyboardKey;
        const gpioPin = p.config.gpioPin;
        if (keyboardKey && gpioPin) {
          this.keyMap.set(keyboardKey.toLowerCase(), gpioPin);
          this.pinToKey.set(keyboardKey.toLowerCase(), p.key);
        }
      }
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    let key = e.key;
    if (key === ' ') key = 'space';
    else key = key.toLowerCase();

    const pin = this.keyMap.get(key);
    if (pin) {
      e.preventDefault();
      gpioBus.write(pin, false);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    let key = e.key;
    if (key === ' ') key = 'space';
    else key = key.toLowerCase();

    const pin = this.keyMap.get(key);
    if (pin) {
      e.preventDefault();
      gpioBus.write(pin, true);
    }
  };

  press(buttonKey: string) {
    const p = this.manifest.peripherals.find((x) => x.type === 'ClickButton' && x.key === buttonKey);
    const pin = p?.config.gpioPin;
    if (pin) {
      gpioBus.write(pin, false);
    }
  }

  release(buttonKey: string) {
    const p = this.manifest.peripherals.find((x) => x.type === 'ClickButton' && x.key === buttonKey);
    const pin = p?.config.gpioPin;
    if (pin) {
      gpioBus.write(pin, true);
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
