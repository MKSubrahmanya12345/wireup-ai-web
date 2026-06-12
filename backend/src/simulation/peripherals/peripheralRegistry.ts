// ??$$$ newer code - Peripheral registry and resolver for simulation v2
import type { PeripheralClass, SensorVariant } from '../../shared/types/SimulationBundle';

interface PeripheralMapping {
  peripheralClass: PeripheralClass;
  sensorVariant?: SensorVariant;
  sensorRange?: { min: number; max: number; default: number; unit: string };
  defaultColor?: string;
  i2cAddress?: string;
  accepts?: string[];
}

export const PERIPHERAL_REGISTRY: Record<string, PeripheralMapping> = {
  // Displays
  'oled_display':         { peripheralClass: 'SSD1306Canvas', i2cAddress: '0x3C' },
  'lcd_display':          { peripheralClass: 'SSD1306Canvas', i2cAddress: '0x27' },

  // Audio
  'audio_amplifier':      { peripheralClass: 'WebAudioOut' },
  'speaker':              { peripheralClass: 'WebAudioOut' },
  'dac_output':           { peripheralClass: 'WebAudioOut' },

  // Storage
  'sd_card':              { peripheralClass: 'VirtualFS', accepts: ['mp3','wav','flac','txt','csv'] },
  'microsd':              { peripheralClass: 'VirtualFS', accepts: ['mp3','wav','flac','txt','csv'] },

  // Buttons/Switches
  'button':               { peripheralClass: 'ClickButton' },
  'tactile_switch':       { peripheralClass: 'ClickButton' },
  'push_button':          { peripheralClass: 'ClickButton' },
  'toggle_switch':        { peripheralClass: 'ClickButton' },

  // LEDs
  'led':                  { peripheralClass: 'LEDIndicator', defaultColor: 'green' },
  'led_red':              { peripheralClass: 'LEDIndicator', defaultColor: 'red' },
  'led_green':            { peripheralClass: 'LEDIndicator', defaultColor: 'green' },
  'led_blue':             { peripheralClass: 'LEDIndicator', defaultColor: 'blue' },
  'led_rgb':              { peripheralClass: 'LEDIndicator', defaultColor: 'rgb' },
  'led_indicator':        { peripheralClass: 'LEDIndicator', defaultColor: 'green' },

  // Motors / Servos
  'motor':                { peripheralClass: 'ServoMotor' }, // ??$$$ newer code
  'servo':                { peripheralClass: 'ServoMotor' }, // ??$$$ newer code
  'servo_motor':          { peripheralClass: 'ServoMotor' }, // ??$$$ newer code

  // Power
  'battery':              { peripheralClass: 'BatteryGauge' },
  'lipo_battery':         { peripheralClass: 'BatteryGauge' },
  'battery_charger':      { peripheralClass: 'BatteryGauge' },

  // Sensors
  'temp_humidity_sensor': { peripheralClass: 'SensorInput', sensorVariant: 'DHT22',        sensorRange: { min: -40, max: 80,   default: 24,  unit: '°C'  } },
  'temperature_sensor':   { peripheralClass: 'SensorInput', sensorVariant: 'DHT22',        sensorRange: { min: -40, max: 80,   default: 24,  unit: '°C'  } },
  'potentiometer':        { peripheralClass: 'SensorInput', sensorVariant: 'Potentiometer',sensorRange: { min: 0,   max: 1023, default: 512, unit: 'ADC' } },
  'light_sensor':         { peripheralClass: 'SensorInput', sensorVariant: 'Photoresistor',sensorRange: { min: 0,   max: 1023, default: 600, unit: 'lx'  } },
  'ldr':                  { peripheralClass: 'SensorInput', sensorVariant: 'Photoresistor',sensorRange: { min: 0,   max: 1023, default: 600, unit: 'lx'  } },
  'photoresistor':        { peripheralClass: 'SensorInput', sensorVariant: 'Photoresistor',sensorRange: { min: 0,   max: 1023, default: 600, unit: 'lx'  } },
  'ultrasonic_sensor':    { peripheralClass: 'SensorInput', sensorVariant: 'Distance',     sensorRange: { min: 2,   max: 400,  default: 100, unit: 'cm'  } },
  'distance_sensor':      { peripheralClass: 'SensorInput', sensorVariant: 'Distance',     sensorRange: { min: 2,   max: 400,  default: 100, unit: 'cm'  } },
  'pir_sensor':           { peripheralClass: 'SensorInput', sensorVariant: 'Motion',       sensorRange: { min: 0,   max: 1,    default: 0,   unit: ''    } },
  'motion_sensor':        { peripheralClass: 'SensorInput', sensorVariant: 'Motion',       sensorRange: { min: 0,   max: 1,    default: 0,   unit: ''    } },
  'soil_sensor':          { peripheralClass: 'SensorInput', sensorVariant: 'SoilMoisture', sensorRange: { min: 0,   max: 100,  default: 45,  unit: '%'   } },
  'moisture_sensor':      { peripheralClass: 'SensorInput', sensorVariant: 'SoilMoisture', sensorRange: { min: 0,   max: 100,  default: 45,  unit: '%'   } },
  'gas_sensor':           { peripheralClass: 'SensorInput', sensorVariant: 'Gas',          sensorRange: { min: 0,   max: 1000, default: 150, unit: 'ppm' } },
  'smoke_sensor':         { peripheralClass: 'SensorInput', sensorVariant: 'Gas',          sensorRange: { min: 0,   max: 1000, default: 150, unit: 'ppm' } },
};

// Fallback: if componentType is unknown, return a generic analog sensor
export function resolvePeripheral(componentType: string): PeripheralMapping {
  const mapping = PERIPHERAL_REGISTRY[componentType];
  if (mapping) return mapping;
  
  console.warn(`[PeripheralRegistry] Unknown componentType: "${componentType}", defaulting to generic SensorInput`);
  return {
    peripheralClass: 'SensorInput',
    sensorVariant: 'Analog',
    sensorRange: { min: 0, max: 1023, default: 512, unit: 'raw' }
  };
}
