// ??$$$ newer code - Wiring validator for simulation v2
import type { ResolvedPin, MCUProfile, WiringValidation } from '../../shared/types/SimulationBundle';
import { PERIPHERAL_REGISTRY } from '../peripherals/peripheralRegistry';

export function validateWiring(
  resolvedWiring: ResolvedPin[],
  bom: any[],
  mcu: MCUProfile
): WiringValidation {
  const warnings: WiringValidation['warnings'] = [];
  const errors: WiringValidation['errors'] = [];

  // Check 1: Pin conflicts (two components sharing same MCU pin)
  const pinUsage = new Map<string, string[]>();
  for (const wire of resolvedWiring) {
    if (wire.signalType === 'power' || wire.signalType === 'ground') continue;
    const existing = pinUsage.get(wire.mcuPin) || [];
    existing.push(wire.componentKey);
    pinUsage.set(wire.mcuPin, existing);
  }
  for (const [pin, components] of pinUsage.entries()) {
    if (components.length > 1) {
      warnings.push({
        type: 'pin_conflict',
        message: `Pin ${pin} is shared by: ${components.join(', ')}. This will cause signal contention.`,
        components,
      });
    }
  }

  // Check 2: I2C address collisions
  const i2cDevices = bom.filter(b => {
    const mapping = PERIPHERAL_REGISTRY[b.type];
    return mapping?.i2cAddress !== undefined;
  });
  const addressMap = new Map<string, string[]>();
  for (const device of i2cDevices) {
    const addr = PERIPHERAL_REGISTRY[device.type]?.i2cAddress || '';
    const existing = addressMap.get(addr) || [];
    existing.push(device.key);
    addressMap.set(addr, existing);
  }
  for (const [addr, devices] of addressMap.entries()) {
    if (devices.length > 1) {
      warnings.push({
        type: 'i2c_address_collision',
        message: `I2C address ${addr} is used by multiple devices: ${devices.join(', ')}. Only one will respond.`,
        components: devices,
      });
    }
  }

  // Check 3: Power budget
  const CURRENT_DRAW_MA: Record<string, number> = {
    oled_display: 20,
    led: 20,
    led_red: 20,
    led_green: 20,
    led_blue: 20,
    audio_amplifier: 150,
    ultrasonic_sensor: 15,
    temp_humidity_sensor: 1.5,
    pir_sensor: 65,
    sd_card: 100,
    microsd: 100,
    motor_driver: 600,
  };
  const MCU_RAIL_LIMIT_MA = 200;
  let totalDraw = 0;
  for (const item of bom) {
    totalDraw += CURRENT_DRAW_MA[item.type] || 5;
  }
  if (totalDraw > MCU_RAIL_LIMIT_MA) {
    warnings.push({
      type: 'power_budget',
      message: `Estimated current draw ${totalDraw}mA exceeds MCU 3.3V rail limit of ${MCU_RAIL_LIMIT_MA}mA. Use external power supply.`,
      components: bom.map(b => b.key),
    });
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
