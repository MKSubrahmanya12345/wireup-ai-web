// ??$$$ newer code - SimulationManifest v2 — pure translator, zero classification logic
// All intelligence lives in the backend SimulationCompiler

import type { SimulationBundle, ResolvedPeripheral, LogicRule, SimulationDriver } from '../../../../shared/types/SimulationBundle';

export type PeripheralType =
  | 'SSD1306Canvas' | 'WebAudioOut' | 'VirtualFS' | 'ClickButton'
  | 'BatteryGauge' | 'SerialMonitor' | 'LEDIndicator' | 'SensorInput'
  | 'ServoMotor'; // ??$$$ newer code

export interface PeripheralConfig {
  key: string;
  type: PeripheralType;
  pins: string[];
  config: Record<string, any>;
}

export interface SimulationManifest {
  projectName: string;
  mcu: string;
  archetype: string;
  peripherals: PeripheralConfig[];
  serialBehavior: string[];
  powerDrawMa: number;
  batteryCapacityMah: number;
  // ??$$$ newer code
  logicRules?: LogicRule[];
  drivers?: SimulationDriver[];
}

// Single function: SimulationBundle → SimulationManifest
// No logic. Pure structural translation.
export function bundleToManifest(bundle: SimulationBundle): SimulationManifest {
  const peripherals: PeripheralConfig[] = bundle.peripherals.map((p: ResolvedPeripheral) => {
    const pins = p.resolvedPins
      .filter(rp => rp.signalType !== 'power' && rp.signalType !== 'ground')
      .map(rp => rp.mcuPin);

    const primaryPin = pins[0] || '';

    const config: Record<string, any> = {
      label: p.displayName,
      gpioPin: primaryPin,
    };

    if (p.peripheralClass === 'SSD1306Canvas') {
      config.width = 128;
      config.height = 64;
      config.i2cAddr = p.i2cAddress || '0x3C';
    }

    if (p.peripheralClass === 'ClickButton') {
      config.keyboardKey = p.keyboardKey || '';
      config.activeHigh = false;
    }

    if (p.peripheralClass === 'LEDIndicator') {
      config.color = p.ledColor || 'green';
      config.activeHigh = true;
    }

    if (p.peripheralClass === 'BatteryGauge') {
      config.capacityMah = p.capacityMah || 1000;
    }

    if (p.peripheralClass === 'WebAudioOut') {
      config.dacPins = p.dacPins || pins;
    }

    if (p.peripheralClass === 'VirtualFS') {
      config.accepts = p.accepts || ['mp3', 'wav'];
    }

    if (p.peripheralClass === 'SensorInput') {
      config.sensorType = p.sensorVariant || 'Analog';
      config.min = p.sensorRange?.min ?? 0;
      config.max = p.sensorRange?.max ?? 1023;
      config.defaultValue = p.sensorRange?.default ?? 512;
      config.unit = p.sensorRange?.unit || '';
    }

    if (p.peripheralClass === 'ServoMotor') { // ??$$$ newer code
      config.angle = p.sensorRange?.default ?? 0; // ??$$$ newer code
    } // ??$$$ newer code

    return {
      key: p.key,
      type: p.peripheralClass as PeripheralType,
      pins,
      config,
    };
  });

  return {
    projectName: bundle.projectName,
    mcu: bundle.mcu.displayName,
    archetype: bundle.archetype,
    peripherals,
    serialBehavior: bundle.serialBehavior,
    powerDrawMa: bundle.powerDrawMa,
    batteryCapacityMah: bundle.batteryCapacityMah,
    logicRules: bundle.logicRules,
    drivers: bundle.drivers,
  };
}

// Keep deriveManifest as a compatibility shim — just call bundleToManifest
// Remove entirely once BehaviorPlayground.tsx is updated to pass bundle directly
export function deriveManifest(project: any, blueprint: any): SimulationManifest {
  // If project already has a bundle attached (new API), use it
  if (project?._simulationBundle) {
    return bundleToManifest(project._simulationBundle);
  }
  // Fallback: should not happen once backend is deployed
  console.error('[SimulationManifest] No SimulationBundle found — backend not updated yet');
  return {
    projectName: project?.name || 'Project',
    mcu: 'Unknown',
    archetype: 'generic-io',
    peripherals: [],
    serialBehavior: [],
    powerDrawMa: 80,
    batteryCapacityMah: 1000,
  };
}
