// ??$$$ newer code - SimulationManifest translation logic for behavior playground
export type PeripheralType =
  | 'SSD1306Canvas'
  | 'WebAudioOut'
  | 'VirtualFS'
  | 'ClickButton'
  | 'BatteryGauge'
  | 'SerialMonitor'
  | 'LEDIndicator'
  | 'SensorInput'; // ??$$$ newer code

export interface PeripheralConfig {
  key: string;
  type: PeripheralType;
  pins: string[]; // GPIO pins this peripheral listens to or drives (stripped of mcu. prefix)
  config: Record<string, any>;
}

// ??$$$ newer code
export const SimulationManifest = {
  // Dummy definition for bundler resolution
};

export interface SimulationManifest {
  projectName: string;
  mcu: string;
  archetype: string;
  peripherals: PeripheralConfig[];
  serialBehavior: string[]; // lines the firmware would print in order
  powerDrawMa: number;
  batteryCapacityMah: number;
}

// Derives a SimulationManifest from the formulation session data
export function deriveManifest(project: any, blueprint: any): SimulationManifest {
  const bom = Array.isArray(project?.bom) ? project.bom : [];
  const wiring = Array.isArray(project?.wiring) ? project.wiring : [];
  const milestones = Array.isArray(project?.milestones) ? project.milestones : [];
  const archetype = blueprint?.archetype || 'generic-io';

  const peripherals: PeripheralConfig[] = [];

  // MCU is always present
  const mcuItem = bom.find((b: any) => b.key === 'mcu' || b.type === 'microcontroller');
  const mcuKey = mcuItem?.key || 'mcu';

  // Find wiring connections from/to a given BOM key
  const getWiresFor = (key: string) =>
    wiring.filter((w: any) => w.from?.startsWith(key + '.') || w.to?.startsWith(key + '.'));

  // OLED / display
  const oledItem = bom.find((b: any) =>
    b.key === 'oled' || b.mpn?.includes('SSD1306') || b.displayName?.toLowerCase().includes('oled')
  );
  if (oledItem) {
    const wires = getWiresFor(oledItem.key);
    const sdaPins = wires
      .filter((w: any) => w.from?.includes('SDA') || w.to?.includes('SDA'))
      .map((w: any) => w.from?.startsWith('mcu.') ? w.from.replace('mcu.', '') : w.to?.replace('mcu.', ''))
      .filter(Boolean) as string[];
    peripherals.push({
      key: oledItem.key,
      type: 'SSD1306Canvas',
      pins: sdaPins.length > 0 ? sdaPins : ['GPIO21', 'GPIO22'],
      config: { width: 128, height: 64, i2cAddr: '0x3C' }
    });
  }

  // Audio output (amp + speaker, or DAC pins)
  const ampItem = bom.find((b: any) =>
    b.key === 'amp' || b.mpn?.includes('PAM8403') || b.mpn?.includes('MAX98357') || b.displayName?.toLowerCase().includes('amplif')
  );
  const speakerItem = bom.find((b: any) =>
    b.key === 'speaker' || b.displayName?.toLowerCase().includes('speaker')
  );
  if (ampItem || speakerItem) {
    // Find DAC pins wired to amp
    const dacWires = wiring.filter((w: any) =>
      (w.from?.includes('GPIO25') || w.from?.includes('GPIO26') ||
       w.from?.includes('DAC') || w.from?.includes('dac') ||
       w.to?.includes('GPIO25') || w.to?.includes('GPIO26') ||
       w.to?.includes('DAC') || w.to?.includes('dac'))
    );
    const dacPins = dacWires.map((w: any) => {
      const pin = w.from?.startsWith('mcu.') ? w.from : w.to;
      return pin ? pin.replace('mcu.', '') : null;
    }).filter(Boolean) as string[];
    peripherals.push({
      key: 'audio_out',
      type: 'WebAudioOut',
      pins: dacPins.length > 0 ? dacPins : ['GPIO25', 'GPIO26'],
      config: { dacPins: dacPins.length > 0 ? dacPins : ['GPIO25', 'GPIO26'] }
    });
  }

  // MicroSD / VirtualFS
  const sdItem = bom.find((b: any) =>
    b.key === 'microsd' || b.key === 'sdcard' || b.mpn?.includes('MICROSD') || b.displayName?.toLowerCase().includes('sd card')
  );
  if (sdItem) {
    const csWire = wiring.find((w: any) =>
      (w.from?.includes('CS') && (w.to?.startsWith('mcu.') || w.to?.startsWith('mcu.'))) ||
      (w.to?.includes('CS') && (w.from?.startsWith('mcu.') || w.from?.startsWith('mcu.')))
    );
    const csPinFull = csWire ? (csWire.from?.startsWith('mcu.') ? csWire.from : csWire.to) : 'mcu.GPIO5';
    const csPin = csPinFull.replace('mcu.', '');
    peripherals.push({
      key: sdItem.key,
      type: 'VirtualFS',
      pins: [csPin],
      config: { accepts: ['mp3', 'wav', 'flac'], csPin }
    });
  }

  // Buttons — only actual button/switch components, not passives
  const buttonItems = bom.filter((b: any) => {
    const name = `${b.displayName || ''} ${b.mpn || ''} ${b.purpose || ''}`.toLowerCase();
    // Must look like a button
    const isButton = b.type === 'button' || name.includes('button') || name.includes('switch') || name.includes('tactile');
    // Exclude passives that may mention "button" context
    const isPassive = name.includes('resistor') || name.includes('capacitor') || name.includes('diode') ||
      b.type === 'resistor' || b.type === 'capacitor';
    return isButton && !isPassive;
  });
  const keyMap: Record<string, string> = {
    'btnPlay': 'Space',
    'btnNext': 'ArrowRight',
    'btnPrev': 'ArrowLeft',
    'btnVolUp': 'ArrowUp',
    'btnVolDown': 'ArrowDown',
    'btnPower': 'p',
    'btnPair': 'b',
  };

  // Normalize AI-generated button keys (btn_play, btn_vup, etc.) to canonical camelCase keys
  const normalizeButtonKey = (raw: string): string => {
    const s = raw.toLowerCase().replace(/[_\-\s]/g, '');
    if (s.includes('play') || s.includes('pause')) return 'btnPlay';
    if (s.includes('next')) return 'btnNext';
    if (s.includes('prev') || s.includes('back')) return 'btnPrev';
    if (s.includes('volup') || s.includes('vup') || s.includes('volumeup')) return 'btnVolUp';
    if (s.includes('voldown') || s.includes('vdown') || s.includes('volumedown')) return 'btnVolDown';
    if (s.includes('power') || s.includes('pwr')) return 'btnPower';
    if (s.includes('pair') || s.includes('bt') || s.includes('bluetooth')) return 'btnPair';
    return raw; // unknown — keep as-is
  };
  for (const btn of buttonItems) {
    const canonicalKey = normalizeButtonKey(btn.key);
    const gpioWire = wiring.find((w: any) =>
      (w.from?.startsWith('mcu.') && w.to?.startsWith(btn.key + '.')) ||
      (w.to?.startsWith('mcu.') && w.from?.startsWith(btn.key + '.'))
    );
    const gpioPinFull = gpioWire ? (gpioWire.from?.startsWith('mcu.') ? gpioWire.from : gpioWire.to) : '';
    const gpioPin = gpioPinFull ? gpioPinFull.replace('mcu.', '') : '';
    peripherals.push({
      key: canonicalKey,
      type: 'ClickButton',
      pins: gpioPin ? [gpioPin] : [],
      config: {
        label: btn.displayName?.replace('Tactile Button - ', '').replace('Button - ', '') || btn.key,
        keyboardKey: keyMap[canonicalKey] || '',
        gpioPin,
        activeHigh: false
      }
    });
  }

  // LEDs / output indicators
  const ledItems = bom.filter((b: any) => {
    const name = `${b.displayName || ''} ${b.mpn || ''} ${b.purpose || ''} ${b.key || ''}`.toLowerCase();
    return b.type === 'led' || name.includes('led') || name.includes('bulb') || name.includes('light') && !name.includes('photoresistor') && !name.includes('ldr');
  });
  for (const led of ledItems) {
    const gpioWire = wiring.find((w: any) =>
      (w.from?.startsWith('mcu.') && w.to?.startsWith(led.key + '.')) ||
      (w.to?.startsWith('mcu.') && w.from?.startsWith(led.key + '.'))
    );
    const gpioPinFull = gpioWire ? (gpioWire.from?.startsWith('mcu.') ? gpioWire.from : gpioWire.to) : '';
    const gpioPin = gpioPinFull ? gpioPinFull.replace('mcu.', '') : '';
    const nameLower = `${led.displayName || ''} ${led.key || ''}`.toLowerCase();
    const color = nameLower.includes('red') ? 'red'
      : nameLower.includes('green') ? 'green'
      : nameLower.includes('blue') ? 'blue'
      : nameLower.includes('yellow') ? 'yellow'
      : nameLower.includes('white') ? 'white'
      : 'green';
    peripherals.push({
      key: led.key,
      type: 'LEDIndicator',
      pins: gpioPin ? [gpioPin] : [],
      config: {
        label: led.displayName?.replace('LED - ', '').replace('Light - ', '') || led.key,
        gpioPin,
        color,
        activeHigh: true
      }
    });
  }

  // Battery
  const batteryItem = bom.find((b: any) =>
    b.key === 'battery' || b.mpn?.includes('LIPO') || b.displayName?.toLowerCase().includes('battery')
  );
  const chargerItem = bom.find((b: any) =>
    b.key === 'charger' || b.mpn?.includes('TP4056') || b.displayName?.toLowerCase().includes('charger')
  );
  if (batteryItem) {
    const capacityMah = batteryItem.displayName?.match(/(\d+)\s*mah/i)?.[1]
      ? parseInt(batteryItem.displayName.match(/(\d+)\s*mah/i)![1])
      : 1000;
    // ??$$$ newer code
    peripherals.push({
      key: batteryItem.key,
      type: 'BatteryGauge',
      pins: [],
      config: { capacityMah, chargingPin: chargerItem ? 'charger.CHRG' : '' }
    });
  }

  // ??$$$ newer code
  // Sensors (DHT, LM35, Potentiometer, Photoresistor, etc.)
  const sensorItems = bom.filter((b: any) => {
    const typeHint = `${b.displayName || ''} ${b.purpose || ''} ${b.mpn || ''}`.toLowerCase();
    return b.type === 'sensor' ||
      typeHint.includes('sensor') ||
      typeHint.includes('temp') ||
      typeHint.includes('humidity') ||
      typeHint.includes('potentiometer') ||
      typeHint.includes('light') ||
      typeHint.includes('dht') ||
      typeHint.includes('lm35') ||
      typeHint.includes('ldr');
  });

  for (const s of sensorItems) {
    const gpioWire = wiring.find((w: any) =>
      (w.from?.startsWith('mcu.') && w.to?.startsWith(s.key + '.')) ||
      (w.to?.startsWith('mcu.') && w.from?.startsWith(s.key + '.'))
    );
    const gpioPinFull = gpioWire ? (gpioWire.from?.startsWith('mcu.') ? gpioWire.from : gpioWire.to) : '';
    const gpioPin = gpioPinFull ? gpioPinFull.replace('mcu.', '') : '';

    const nameLower = `${s.displayName || ''} ${s.key || ''}`.toLowerCase();
    const isTempHumid = nameLower.includes('dht') || nameLower.includes('temp') || nameLower.includes('humidity');
    const isPot = nameLower.includes('potentiometer') || nameLower.includes('pot');
    const isLight = nameLower.includes('light') || nameLower.includes('ldr') || nameLower.includes('photoresistor');

    peripherals.push({
      key: s.key,
      type: 'SensorInput' as any,
      pins: gpioPin ? [gpioPin] : [],
      config: {
        label: s.displayName?.replace('Sensor - ', '') || s.key,
        sensorType: isTempHumid ? 'DHT22' : isPot ? 'Potentiometer' : isLight ? 'Photoresistor' : 'Analog',
        gpioPin,
        min: 0,
        max: isTempHumid ? 100 : 1023,
        defaultValue: isTempHumid ? 24 : 512
      }
    });
  }

  // Serial monitor (always present)
  peripherals.push({
    key: 'serial',
    type: 'SerialMonitor',
    pins: ['UART_TX'],
    config: { baudRate: 115200 }
  });

  // Extract likely serial output from milestone code comments and expected outputs
  const serialBehavior: string[] = milestones
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
    .flatMap((m: any) => {
      const lines: string[] = [];
      if (m.expectedOutput) {
        lines.push(...String(m.expectedOutput).split('\n').slice(0, 5).filter(Boolean));
      }
      return lines;
    })
    .slice(0, 30);

  // Power draw estimation
  const powerDrawMa = blueprint?.powerProfile?.drawClass === 'high-spike' ? 500
    : blueprint?.powerProfile?.drawClass === 'medium' ? 210
    : 80;

  const batteryCapacity = batteryItem
    ? (batteryItem.displayName?.match(/(\d+)\s*mah/i)?.[1]
        ? parseInt(batteryItem.displayName.match(/(\d+)\s*mah/i)![1])
        : 1000)
    : 1000;

  return {
    projectName: project?.name || 'Hardware Project',
    mcu: mcuItem?.displayName || blueprint?.computeRequirements?.mcu || 'ESP32',
    archetype,
    peripherals,
    serialBehavior,
    powerDrawMa,
    batteryCapacityMah: batteryCapacity
  };
}
