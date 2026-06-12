// ??$$$ newer code - Pin resolver logic for simulation v2
import type { ResolvedPin, MCUProfile } from '../../shared/types/SimulationBundle';

export function resolveWiring(
  wiring: Array<{ from: string; to: string; color?: string }>,
  mcu: MCUProfile
): ResolvedPin[] {
  const resolved: ResolvedPin[] = [];

  for (const wire of wiring) {
    const fromParts = wire.from.split('.');
    const toParts = wire.to.split('.');
    if (fromParts.length < 2 || toParts.length < 2) continue;

    const [fromKey, fromPin] = fromParts;
    const [toKey, toPin] = toParts;

    // Determine which end is the MCU
    const isMCUFrom = fromKey === 'mcu';
    const mcuPin = isMCUFrom ? normalizeMCUPin(fromPin, mcu) : normalizeMCUPin(toPin, mcu);
    const componentKey = isMCUFrom ? toKey : fromKey;
    const componentPin = isMCUFrom ? toPin : fromPin;

    if (!mcuPin) continue;

    resolved.push({
      componentKey,
      componentPin,
      mcuPin,
      netName: `${componentKey}_${componentPin}`,
      signalType: classifySignal(componentPin, mcuPin, mcu),
    });
  }

  return resolved;
}

export function normalizeMCUPin(raw: string, mcu: MCUProfile): string | null {
  const upper = (raw || '').toUpperCase();

  // Direct match
  if (mcu.digitalPins.includes(upper) || mcu.analogPins.includes(upper)) return upper;

  // Named alias resolution
  if (upper === 'SDA') return mcu.i2cPins.sda;
  if (upper === 'SCL') return mcu.i2cPins.scl;
  if (upper === 'MOSI') return mcu.spiPins.mosi;
  if (upper === 'MISO') return mcu.spiPins.miso;
  if (upper === 'SCK' || upper === 'CLK') return mcu.spiPins.sck;
  if (upper === 'TX' || upper === 'TXD') return mcu.uartPins.tx;
  if (upper === 'RX' || upper === 'RXD') return mcu.uartPins.rx;

  // Numeric only → D{n} for Arduino
  if (/^\d+$/.test(raw)) return `D${raw}`;

  return upper || null;
}

export function classifySignal(componentPin: string, mcuPin: string, mcu: MCUProfile): ResolvedPin['signalType'] {
  const cp = (componentPin || '').toUpperCase();
  const mp = (mcuPin || '').toUpperCase();

  if (cp === 'VCC' || cp === '5V' || cp === '3V3' || cp === 'VIN') return 'power';
  if (cp === 'GND' || cp === 'CATHODE' || cp === 'GND2') return 'ground';
  if (cp === 'SDA' || mp === mcu.i2cPins.sda.toUpperCase()) return 'i2c';
  if (cp === 'SCL' || mp === mcu.i2cPins.scl.toUpperCase()) return 'i2c';
  if (cp === 'MOSI' || cp === 'MISO' || cp === 'SCK' || cp === 'CS') return 'spi';
  if (cp === 'TX' || cp === 'RX') return 'uart';
  if (mcu.analogPins.map(p => p.toUpperCase()).includes(mp)) return 'analog';
  return 'digital';
}
