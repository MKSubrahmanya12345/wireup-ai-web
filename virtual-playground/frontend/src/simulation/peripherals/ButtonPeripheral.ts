import type { ComponentItem, Wiring } from '../../types/project';

type WorkerLike = {
  postMessage: (message: unknown) => void;
};

const normalizePin = (value: string) => {
  let pin = String(value || '').trim().toUpperCase();
  if (!pin) {
    return 'D2';
  }

  if (pin === 'SDA') {
    return 'A4';
  }

  if (pin === 'SCL') {
    return 'A5';
  }

  if (/^GPIO\d+$/.test(pin)) {
    pin = `D${pin.slice(4)}`;
  }

  if (/^\d+$/.test(pin)) {
    pin = `D${pin}`;
  }

  return pin;
};

const parseEndpoint = (value: string) => {
  const [partKey = '', ...pinParts] = String(value || '').split('.');
  return {
    partKey: partKey.trim().toLowerCase(),
    pin: pinParts.join('.').trim()
  };
};

const isButtonComponent = (item: ComponentItem) => {
  const type = String(item?.type || '').toLowerCase();
  const name = String(item?.displayName || item?.key || '').toLowerCase();
  return type === 'button' || name.includes('button') || name.includes('switch');
};

const isMicrocontrollerComponent = (item: ComponentItem) => {
  const type = String(item?.type || '').toLowerCase();
  const name = String(item?.displayName || item?.key || '').toLowerCase();
  return type === 'microcontroller' || name.includes('arduino') || name.includes('uno');
};

export class ButtonPeripheral {
  readonly pin: string;

  constructor(wiring: Wiring[], bom: ComponentItem[] = []) {
    const buttonKeys = new Set(
      bom.filter(isButtonComponent).map((item) => String(item.key || '').toLowerCase())
    );
    const mcuKeys = new Set(
      bom.filter(isMicrocontrollerComponent).map((item) => String(item.key || '').toLowerCase())
    );

    mcuKeys.add('arduino');
    mcuKeys.add('mcu');

    let resolvedPin = 'D2';

    for (const wire of wiring || []) {
      const from = parseEndpoint(wire.from);
      const to = parseEndpoint(wire.to);

      if (buttonKeys.has(from.partKey) && mcuKeys.has(to.partKey) && to.pin) {
        resolvedPin = normalizePin(to.pin);
        break;
      }

      if (buttonKeys.has(to.partKey) && mcuKeys.has(from.partKey) && from.pin) {
        resolvedPin = normalizePin(from.pin);
        break;
      }
    }

    this.pin = resolvedPin;
  }

  press(worker: WorkerLike | null) {
    worker?.postMessage({ type: 'button', pin: this.pin, state: false });
  }

  release(worker: WorkerLike | null) {
    worker?.postMessage({ type: 'button', pin: this.pin, state: true });
  }
}
