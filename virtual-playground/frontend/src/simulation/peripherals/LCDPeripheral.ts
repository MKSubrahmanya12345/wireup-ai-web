import type { ComponentItem, Wiring } from '../../types/project';

type LCDUpdateListener = (line1: string, line2: string, backlight: boolean) => void;

const isDisplayComponent = (item: ComponentItem) => {
  const type = String(item?.type || '').toLowerCase();
  const name = String(item?.displayName || item?.key || '').toLowerCase();
  return type === 'display' || name.includes('lcd');
};

export class LCDPeripheral {
  readonly present: boolean;
  readonly componentKey: string | null;

  private line1 = ''.padEnd(16, ' ');
  private line2 = ''.padEnd(16, ' ');
  private backlight = false;
  private listeners = new Set<LCDUpdateListener>();

  constructor(_wiring: Wiring[], bom: ComponentItem[] = []) {
    const display = bom.find(isDisplayComponent) || null;
    this.present = Boolean(display);
    this.componentKey = display?.key || null;
  }

  onUpdate(listener: LCDUpdateListener) {
    this.listeners.add(listener);
    listener(this.line1, this.line2, this.backlight);

    return () => {
      this.listeners.delete(listener);
    };
  }

  applyUpdate(line1: string, line2: string, backlight: boolean) {
    const nextLine1 = String(line1 || '').slice(0, 16).padEnd(16, ' ');
    const nextLine2 = String(line2 || '').slice(0, 16).padEnd(16, ' ');
    const changed =
      nextLine1 !== this.line1 ||
      nextLine2 !== this.line2 ||
      backlight !== this.backlight;

    if (!changed) {
      return;
    }

    this.line1 = nextLine1;
    this.line2 = nextLine2;
    this.backlight = backlight;

    for (const listener of this.listeners) {
      listener(this.line1, this.line2, this.backlight);
    }
  }
}
