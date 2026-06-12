// ??$$$ newer code - SimulationCompiler orchestrator for simulation v2
import { resolveMCUProfile } from './mcu/mcuProfiles';
import { resolvePeripheral } from './peripherals/peripheralRegistry';
import { scoreArchetype } from './archetype/archetypeScorer';
import { resolveWiring, normalizeMCUPin, classifySignal } from './pins/pinResolver';
import { validateWiring } from './validation/wiringValidator';
import { analyzeSketch } from './analyzer/sketchAnalyzer';
import type { SimulationBundle, ResolvedPeripheral, ResolvedPin, MCUProfile, LogicRule, SimulationDriver } from '../shared/types/SimulationBundle';

const POWER_DRAW_BY_CLASS: Record<string, number> = {
  SSD1306Canvas: 20,
  WebAudioOut: 150,
  VirtualFS: 100,
  ClickButton: 0.1,
  LEDIndicator: 20,
  BatteryGauge: 0,
  SerialMonitor: 0,
  SensorInput: 10,
  ServoMotor: 150, // ??$$$ newer code
};

const normalizeMCUPinPublic = normalizeMCUPin;
const classifySignalPublic = classifySignal;

// ??$$$ newer code - fallback logic generator for standard BOM items
function generateFallbackRules(peripherals: ResolvedPeripheral[]): LogicRule[] {
  const rules: LogicRule[] = [];

  const pot = peripherals.find(p => p.sensorVariant === 'Potentiometer');
  const dist = peripherals.find(p => p.sensorVariant === 'Distance');
  const motion = peripherals.find(p => p.sensorVariant === 'Motion');
  const led = peripherals.find(p => p.peripheralClass === 'LEDIndicator');

  if (pot && led) {
    const potPin = pot.resolvedPins[0]?.mcuPin || 'A0';
    const ledPin = led.resolvedPins[0]?.mcuPin || 'D13';
    rules.push(
      {
        id: 'fallback_pot_led_on',
        inputPinOrKey: potPin,
        operator: '>',
        threshold: 512,
        outputPinOrKey: ledPin,
        actionValue: true
      },
      {
        id: 'fallback_pot_led_off',
        inputPinOrKey: potPin,
        operator: '<=',
        threshold: 512,
        outputPinOrKey: ledPin,
        actionValue: false
      }
    );
  }

  if (dist && led) {
    const distPin = dist.resolvedPins[0]?.mcuPin || 'GPIO32';
    const ledPin = led.resolvedPins[0]?.mcuPin || 'D13';
    rules.push(
      {
        id: 'fallback_dist_led_on',
        inputPinOrKey: distPin,
        operator: '<',
        threshold: 20,
        outputPinOrKey: ledPin,
        actionValue: true
      },
      {
        id: 'fallback_dist_led_off',
        inputPinOrKey: distPin,
        operator: '>=',
        threshold: 20,
        outputPinOrKey: ledPin,
        actionValue: false
      }
    );
  }

  if (motion && led) {
    const motionPin = motion.resolvedPins[0]?.mcuPin || 'GPIO33';
    const ledPin = led.resolvedPins[0]?.mcuPin || 'D13';
    rules.push(
      {
        id: 'fallback_motion_led_on',
        inputPinOrKey: motionPin,
        operator: '==',
        threshold: 1,
        outputPinOrKey: ledPin,
        actionValue: true
      },
      {
        id: 'fallback_motion_led_off',
        inputPinOrKey: motionPin,
        operator: '==',
        threshold: 0,
        outputPinOrKey: ledPin,
        actionValue: false
      }
    );
  }

  return rules;
}

export function compileSimulationBundle(
  sessionId: string,
  project: {
    name: string;
    bom: any[];
    wiring: any[];
    milestones: any[];
    sketch: string;
    context?: { mcu?: string; powerSource?: string; batteryCapacityMah?: number; logicRules?: LogicRule[] };
  }
): SimulationBundle {

  // 1. Resolve MCU
  const mcuString = project.context?.mcu || 'arduino-uno';
  const mcu = resolveMCUProfile(mcuString);

  // 2. Resolve peripherals — reads componentType only, no string sniffing
  const resolvedPeripherals: ResolvedPeripheral[] = [];

  for (const item of project.bom) {
    // Skip the MCU itself
    if (item.key === 'mcu' || item.type === 'microcontroller') continue;

    const mapping = resolvePeripheral(item.type);

    // Find all wires connected to this component
    const connectedWires = project.wiring.filter(
      (w: any) => w.from?.startsWith(item.key + '.') || w.to?.startsWith(item.key + '.')
    );

    // Build resolved pins for this peripheral
    const resolvedPins = connectedWires.map((wire: any) => {
      const isMCUFrom = wire.from?.startsWith('mcu.');
      const mcuRaw = isMCUFrom ? wire.from.split('.')[1] : wire.to.split('.')[1];
      const compPin = isMCUFrom ? wire.to.split('.')[1] : wire.from.split('.')[1];
      const mcuPin = normalizeMCUPinPublic(mcuRaw, mcu);

      return {
        componentKey: item.key,
        componentPin: compPin || '',
        mcuPin: mcuPin || mcuRaw || '',
        netName: `${item.key}_${compPin}`,
        signalType: classifySignalPublic(compPin, mcuPin || '', mcu),
      };
    });

    // Infer LED color from displayName only if type is generic 'led' (not led_red etc.)
    let ledColor = mapping.defaultColor;
    if (item.type === 'led' && item.displayName) {
      const name = item.displayName.toLowerCase();
      if (name.includes('red')) ledColor = 'red';
      else if (name.includes('green')) ledColor = 'green';
      else if (name.includes('blue')) ledColor = 'blue';
      else if (name.includes('yellow')) ledColor = 'yellow';
      else if (name.includes('white')) ledColor = 'white';
      else if (name.includes('rgb')) ledColor = 'rgb';
    }

    // Infer button keyboard key from key name (canonical mapping)
    let keyboardKey: string | undefined;
    if (mapping.peripheralClass === 'ClickButton') {
      keyboardKey = resolveButtonKeyboardKey(item.key);
    }

    // Battery capacity
    let capacityMah = project.context?.batteryCapacityMah;
    if (!capacityMah && mapping.peripheralClass === 'BatteryGauge') {
      // Try to parse from displayName as last resort (only here, not in the frontend)
      const match = item.displayName?.match(/(\d+)\s*mah/i);
      capacityMah = match ? parseInt(match[1]) : 1000;
    }

    // DAC pins for audio
    let dacPins: string[] | undefined;
    if (mapping.peripheralClass === 'WebAudioOut') {
      dacPins = mcu.dacPins || [mcu.analogPins[0]];
    }

    resolvedPeripherals.push({
      key: item.key,
      peripheralClass: mapping.peripheralClass,
      displayName: item.displayName || item.key,
      resolvedPins,
      sensorVariant: mapping.sensorVariant,
      sensorRange: mapping.sensorRange,
      i2cAddress: mapping.i2cAddress,
      ledColor: ledColor as any,
      keyboardKey,
      capacityMah,
      accepts: mapping.accepts,
      dacPins,
    });
  }

  // Always add serial monitor
  resolvedPeripherals.push({
    key: 'serial',
    peripheralClass: 'SerialMonitor',
    displayName: 'Serial Monitor',
    resolvedPins: [{ componentKey: 'serial', componentPin: 'TX', mcuPin: mcu.uartPins.tx, netName: 'UART_TX', signalType: 'uart' }],
  });

  // 3. Score archetype
  const { archetype, confidence } = scoreArchetype(project.bom);

  // 4. Resolve and validate wiring
  const resolvedWiring = resolveWiring(project.wiring, mcu);
  const validation = validateWiring(resolvedWiring, project.bom, mcu);

  // 5. Power budget
  let totalPowerMa = 80; // MCU base draw
  for (const p of resolvedPeripherals) {
    totalPowerMa += POWER_DRAW_BY_CLASS[p.peripheralClass] || 5;
  }
  const batteryCapacityMah = project.context?.batteryCapacityMah
    || resolvedPeripherals.find(p => p.peripheralClass === 'BatteryGauge')?.capacityMah
    || 1000;
  const estimatedRuntimeHours = Number((batteryCapacityMah / totalPowerMa).toFixed(2));

  // 6. Run SketchAnalyzer for protocol matching and serial behaviors
  const analyzed = analyzeSketch(project.sketch);

  // Merge Serial.println strings with milestone logs
  const serialBehavior = [
    ...analyzed.serialLines,
    ...project.milestones
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      .flatMap((m: any) => {
        if (!m.expectedOutput) return [];
        return String(m.expectedOutput).split('\n').slice(0, 5).filter(Boolean);
      })
  ].slice(0, 30);

  // 7. Resolve logic rules from LLM context, with auto-generated fallbacks
  const logicRules: LogicRule[] = project.context?.logicRules 
    || (project as any).logicRules 
    || generateFallbackRules(resolvedPeripherals);

  // 8. Build Simulation Drivers
  const drivers: SimulationDriver[] = [];

  if (analyzed.protocols.bluetooth) {
    drivers.push({
      componentKey: 'serial_bt',
      inputs: [
        {
          type: 'text_input',
          label: 'Bluetooth Command',
          injectsAs: 'serial_receive',
        }
      ],
      outputs: [
        {
          type: 'serial_line',
          triggeredBy: 'serial_print',
        }
      ]
    });
  }

  if (analyzed.protocols.wifi) {
    const inputs = analyzed.wifiRoutes.map(route => ({
      type: 'button' as const,
      label: `GET ${route}`,
      injectsAs: 'http_request' as const,
      config: { route }
    }));
    drivers.push({
      componentKey: 'wifi',
      inputs,
      outputs: [
        {
          type: 'serial_line',
          triggeredBy: 'serial_print',
        }
      ]
    });
  }

  const fsPeripheral = resolvedPeripherals.find(p => p.peripheralClass === 'VirtualFS');
  if (fsPeripheral) {
    drivers.push({
      componentKey: fsPeripheral.key,
      inputs: [
        {
          type: 'file_upload',
          label: 'Upload File',
          injectsAs: 'analog_read',
          config: { accepts: fsPeripheral.accepts || ['mp3', 'wav'] }
        }
      ],
      outputs: []
    });
  }

  return {
    version: '2.0',
    projectName: project.name || 'Hardware Project',
    sessionId,
    mcu,
    simulationMode: mcu.simulationMode,
    simulationModeReason: mcu.simulationMode === 'avr-hardware'
      ? `${mcu.displayName} is AVR-compatible — full firmware execution via avr8js`
      : `${mcu.displayName} requires behavior simulation — firmware execution not supported in browser`,
    archetype,
    archetypeConfidence: confidence,
    peripherals: resolvedPeripherals,
    powerDrawMa: totalPowerMa,
    batteryCapacityMah,
    estimatedRuntimeHours,
    resolvedWiring,
    validation,
    serialBehavior,
    drivers,
    logicRules,
    raw: {
      sketch: project.sketch || '',
      bom: project.bom,
      wiring: project.wiring,
      milestones: project.milestones,
    },
  };
}

// Button key canonical map — kept here in backend, not frontend
function resolveButtonKeyboardKey(key: string): string {
  const s = key.toLowerCase().replace(/[_\-\s]/g, '');
  if (s.includes('play') || s.includes('pause')) return 'Space';
  if (s.includes('next')) return 'ArrowRight';
  if (s.includes('prev') || s.includes('back')) return 'ArrowLeft';
  if (s.includes('volup') || s.includes('vup')) return 'ArrowUp';
  if (s.includes('voldown') || s.includes('vdown')) return 'ArrowDown';
  if (s.includes('power') || s.includes('pwr')) return 'p';
  if (s.includes('pair') || s.includes('bluetooth') || s.includes('bt')) return 'b';
  return '';
}
