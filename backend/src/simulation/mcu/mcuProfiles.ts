// ??$$$ newer code - MCU Profile registry and resolver for simulation v2
import type { MCUProfile } from '../../shared/types/SimulationBundle';

export const MCU_PROFILES: Record<string, MCUProfile> = {
  'arduino-uno': {
    key: 'arduino-uno',
    displayName: 'Arduino Uno (ATmega328P)',
    simulationMode: 'avr-hardware',
    fqbn: 'arduino:avr:uno',
    clockHz: 16_000_000,
    flashKb: 32,
    ramKb: 2,
    analogPins: ['A0','A1','A2','A3','A4','A5'],
    digitalPins: ['D0','D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13'],
    i2cPins: { sda: 'A4', scl: 'A5' },
    spiPins: { mosi: 'D11', miso: 'D12', sck: 'D13' },
    uartPins: { tx: 'D1', rx: 'D0' },
    pwmPins: ['D3','D5','D6','D9','D10','D11'],
  },
  'esp32-devkit': {
    key: 'esp32-devkit',
    displayName: 'ESP32 DevKit V1',
    simulationMode: 'behavior',
    fqbn: 'esp32:esp32:esp32',
    clockHz: 240_000_000,
    flashKb: 4096,
    ramKb: 520,
    analogPins: ['GPIO32','GPIO33','GPIO34','GPIO35','GPIO36','GPIO39'],
    digitalPins: ['GPIO0','GPIO2','GPIO4','GPIO5','GPIO12','GPIO13','GPIO14','GPIO15','GPIO16','GPIO17','GPIO18','GPIO19','GPIO21','GPIO22','GPIO23','GPIO25','GPIO26','GPIO27'],
    i2cPins: { sda: 'GPIO21', scl: 'GPIO22' },
    spiPins: { mosi: 'GPIO23', miso: 'GPIO19', sck: 'GPIO18' },
    uartPins: { tx: 'GPIO17', rx: 'GPIO16' },
    dacPins: ['GPIO25', 'GPIO26'],
    pwmPins: ['GPIO2','GPIO4','GPIO5','GPIO12','GPIO13','GPIO14','GPIO15','GPIO16','GPIO17','GPIO18','GPIO19','GPIO21','GPIO22','GPIO23','GPIO25','GPIO26','GPIO27'],
  },
  'esp32-s3': {
    key: 'esp32-s3',
    displayName: 'ESP32-S3',
    simulationMode: 'behavior',
    fqbn: 'esp32:esp32:esp32s3',
    clockHz: 240_000_000,
    flashKb: 8192,
    ramKb: 512,
    analogPins: ['GPIO1','GPIO2','GPIO3','GPIO4','GPIO5','GPIO6','GPIO7','GPIO8','GPIO9','GPIO10'],
    digitalPins: ['GPIO0','GPIO11','GPIO12','GPIO13','GPIO14','GPIO15','GPIO16','GPIO17','GPIO18','GPIO19','GPIO20','GPIO21','GPIO35','GPIO36','GPIO37','GPIO38','GPIO39','GPIO40','GPIO41','GPIO42','GPIO43','GPIO44','GPIO45','GPIO46','GPIO47','GPIO48'],
    i2cPins: { sda: 'GPIO8', scl: 'GPIO9' },
    spiPins: { mosi: 'GPIO11', miso: 'GPIO13', sck: 'GPIO12' },
    uartPins: { tx: 'GPIO43', rx: 'GPIO44' },
    pwmPins: [],
  },
  'arduino-nano': {
    key: 'arduino-nano',
    displayName: 'Arduino Nano (ATmega328P)',
    simulationMode: 'avr-hardware',
    fqbn: 'arduino:avr:nano',
    clockHz: 16_000_000,
    flashKb: 32,
    ramKb: 2,
    analogPins: ['A0','A1','A2','A3','A4','A5','A6','A7'],
    digitalPins: ['D0','D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13'],
    i2cPins: { sda: 'A4', scl: 'A5' },
    spiPins: { mosi: 'D11', miso: 'D12', sck: 'D13' },
    uartPins: { tx: 'D1', rx: 'D0' },
    pwmPins: ['D3','D5','D6','D9','D10','D11'],
  },
};

// Fuzzy resolver: given an LLM-generated MCU string, return the best matching profile key
export function resolveMCUProfile(mcuString: string): MCUProfile {
  const s = mcuString.toLowerCase().replace(/[\s\-_]/g, '');
  
  if (s.includes('esp32s3') || s.includes('esp32-s3')) return MCU_PROFILES['esp32-s3'];
  if (s.includes('esp32')) return MCU_PROFILES['esp32-devkit'];
  if (s.includes('nano')) return MCU_PROFILES['arduino-nano'];
  if (s.includes('uno') || s.includes('atmega328') || s.includes('arduino')) return MCU_PROFILES['arduino-uno'];
  
  // Default: if unknown, use behavior mode with ESP32 profile
  console.warn(`[MCUResolver] Unknown MCU: "${mcuString}", defaulting to esp32-devkit`);
  return MCU_PROFILES['esp32-devkit'];
}
