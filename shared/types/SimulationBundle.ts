// ??$$$ newer code - SimulationBundle shared types for simulation v2
export type PeripheralClass =
  | 'SSD1306Canvas'
  | 'WebAudioOut'
  | 'VirtualFS'
  | 'ClickButton'
  | 'LEDIndicator'
  | 'BatteryGauge'
  | 'SerialMonitor'
  | 'SensorInput'
  | 'ServoMotor'; // ??$$$ newer code

export type SensorVariant =
  | 'DHT22'
  | 'Potentiometer'
  | 'Photoresistor'
  | 'Distance'
  | 'Motion'
  | 'SoilMoisture'
  | 'Gas'
  | 'Analog';

export type SimulationMode = 'avr-hardware' | 'behavior';

export type Archetype =
  | 'audio-device'
  | 'sensor-logger'
  | 'motor-controller'
  | 'display-ui'
  | 'iot-node'
  | 'generic-io';

export interface ResolvedPin {
  componentKey: string;
  componentPin: string;       // e.g. "SDA", "ANODE", "TRIG"
  mcuPin: string;             // e.g. "GPIO21", "D9", "A0"
  netName: string;            // e.g. "I2C_SDA", "LED_D13"
  signalType: 'digital' | 'analog' | 'i2c' | 'spi' | 'uart' | 'power' | 'ground';
}

export interface ResolvedPeripheral {
  key: string;
  peripheralClass: PeripheralClass;
  displayName: string;
  resolvedPins: ResolvedPin[];

  // Class-specific config — only the relevant fields will be populated
  sensorVariant?: SensorVariant;
  sensorRange?: { min: number; max: number; default: number; unit: string };
  i2cAddress?: string;
  ledColor?: 'red' | 'green' | 'blue' | 'yellow' | 'white' | 'rgb';
  keyboardKey?: string;
  capacityMah?: number;
  accepts?: string[];         // For VirtualFS: ['mp3', 'wav']
  dacPins?: string[];         // For WebAudioOut
}

export interface MCUProfile {
  key: string;                // 'arduino-uno', 'esp32-devkit', 'esp32-s3', etc.
  displayName: string;
  simulationMode: SimulationMode;
  fqbn: string;               // arduino:avr:uno | esp32:esp32:esp32
  clockHz: number;
  flashKb: number;
  ramKb: number;
  // Pin naming convention for this MCU
  analogPins: string[];       // ['A0','A1',...] or ['GPIO32','GPIO33',...]
  digitalPins: string[];
  i2cPins: { sda: string; scl: string };
  spiPins: { mosi: string; miso: string; sck: string };
  uartPins: { tx: string; rx: string };
  dacPins?: string[];
  pwmPins?: string[];
}

export interface WiringValidation {
  valid: boolean;
  warnings: Array<{
    type: 'pin_conflict' | 'i2c_address_collision' | 'power_budget' | 'missing_pullup' | 'unconnected_required_pin';
    message: string;
    components: string[];
  }>;
  errors: Array<{
    type: string;
    message: string;
    components: string[];
  }>;
}

export interface SimulationBundle {
  version: '2.0';
  projectName: string;
  sessionId: string;

  // MCU
  mcu: MCUProfile;

  // Routing decision
  simulationMode: SimulationMode;
  simulationModeReason: string;

  // Archetype
  archetype: Archetype;
  archetypeConfidence: number;  // 0-100

  // All peripherals, fully resolved
  peripherals: ResolvedPeripheral[];

  // Power budget
  powerDrawMa: number;
  batteryCapacityMah: number;
  estimatedRuntimeHours: number;

  // Wiring
  resolvedWiring: ResolvedPin[];

  // Wiring validation
  validation: WiringValidation;

  // Serial behavior derived from milestones (for behavior mode)
  serialBehavior: string[];

  // Raw data passthrough (for frontend file viewer)
  raw: {
    sketch: string;
    bom: any[];
    wiring: any[];
    milestones: any[];
  };
}
