// ??$$$ newer code - Archetype scorer logic for simulation v2
import type { Archetype } from '../../shared/types/SimulationBundle';

const ARCHETYPE_SCORES: Record<Archetype, Partial<Record<string, number>>> = {
  'audio-device': {
    audio_amplifier: 50,
    speaker: 30,
    sd_card: 25,
    microsd: 25,
    dac_output: 20,
    button: 5,
    battery: 5,
  },
  'sensor-logger': {
    temp_humidity_sensor: 40,
    temperature_sensor: 40,
    ultrasonic_sensor: 35,
    distance_sensor: 35,
    pir_sensor: 35,
    motion_sensor: 35,
    gas_sensor: 35,
    soil_sensor: 35,
    light_sensor: 25,
    ldr: 25,
    oled_display: 10,
    sd_card: 15,
  },
  'display-ui': {
    oled_display: 50,
    lcd_display: 50,
    button: 10,
    potentiometer: 10,
  },
  'motor-controller': {
    motor_driver: 60,
    dc_motor: 40,
    servo_motor: 40,
    stepper_motor: 40,
  },
  'iot-node': {
    wifi_module: 50,
    bluetooth_module: 40,
    mqtt_client: 40,
    temp_humidity_sensor: 15,
    led: 5,
  },
  'generic-io': {},
};

export function scoreArchetype(bom: Array<{ type: string }>): { archetype: Archetype; confidence: number } {
  const totals: Record<string, number> = {
    'audio-device': 0,
    'sensor-logger': 0,
    'display-ui': 0,
    'motor-controller': 0,
    'iot-node': 0,
    'generic-io': 1,  // baseline so it always has a score
  };

  for (const item of bom) {
    for (const [arch, componentScores] of Object.entries(ARCHETYPE_SCORES)) {
      const score = componentScores[item.type] || 0;
      totals[arch] += score;
    }
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const [topArchetype, topScore] = sorted[0];
  const maxPossible = 200; // rough ceiling

  return {
    archetype: topArchetype as Archetype,
    confidence: Math.min(100, Math.round((topScore / maxPossible) * 100)),
  };
}
