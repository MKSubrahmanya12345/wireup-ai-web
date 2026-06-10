// ??$$$ newer code
// backend/src/agents/architect/mcu.catalog.ts
// Curated MCU capability table. Source of truth for select_compute.
// Specs are real-world. Only boards with a Wokwi part type are simulatable.

export interface IMcuSpec {
  key: string;              // canonical key, used as BOM 'mcu'
  displayName: string;
  wokwiPartType: string;    // "" = not simulatable in Wokwi
  usableGpio: number;       // realistic usable IO pin count
  peripherals: {
    i2c: number;
    spi: number;
    uart: number;
    pwm: number;
    adc: number;
  };
  flashKB: number;
  ramKB: number;
  voltage: "3.3V" | "5V";
  realtimeCapable: boolean; // can it handle audio/control loops?
  connectivity: {
    wifi: boolean;
    bluetooth: boolean;
  };
  clockMHz: number;
  note: string;
  costRank: number;         // 1 = cheapest/simplest, higher = more premium
}

export const MCU_CATALOG: IMcuSpec[] = [
  {
    key: "arduino-uno",
    displayName: "Arduino Uno (ATmega328P)",
    wokwiPartType: "wokwi-arduino-uno",
    usableGpio: 20,
    peripherals: { i2c: 1, spi: 1, uart: 1, pwm: 6, adc: 6 },
    flashKB: 32, ramKB: 2,
    voltage: "5V",
    realtimeCapable: false,
    connectivity: { wifi: false, bluetooth: false },
    clockMHz: 16,
    note: "8-bit beginner board. Great for LEDs/buttons/basic sensors. Cannot do audio decoding, WiFi, or Bluetooth.",
    costRank: 1
  },
  {
    key: "arduino-nano",
    displayName: "Arduino Nano (ATmega328P)",
    wokwiPartType: "wokwi-arduino-nano",
    usableGpio: 22,
    peripherals: { i2c: 1, spi: 1, uart: 1, pwm: 6, adc: 8 },
    flashKB: 32, ramKB: 2,
    voltage: "5V",
    realtimeCapable: false,
    connectivity: { wifi: false, bluetooth: false },
    clockMHz: 16,
    note: "Compact Uno. Same limits. Good for small wired projects.",
    costRank: 1
  },
  {
    key: "arduino-mega",
    displayName: "Arduino Mega 2560",
    wokwiPartType: "wokwi-arduino-mega",
    usableGpio: 70,
    peripherals: { i2c: 1, spi: 1, uart: 4, pwm: 15, adc: 16 },
    flashKB: 256, ramKB: 8,
    voltage: "5V",
    realtimeCapable: false,
    connectivity: { wifi: false, bluetooth: false },
    clockMHz: 16,
    note: "Many pins / multiple UARTs. Use when pin count is high. Still 8-bit, no wireless.",
    costRank: 4
  },
  {
    key: "esp32-devkit-v1",
    displayName: "ESP32 DevKit v1",
    wokwiPartType: "wokwi-esp32-devkit-v1",
    usableGpio: 25,
    peripherals: { i2c: 2, spi: 2, uart: 3, pwm: 16, adc: 18 },
    flashKB: 4096, ramKB: 520,
    voltage: "3.3V",
    realtimeCapable: true,
    connectivity: { wifi: true, bluetooth: true },
    clockMHz: 240,
    note: "Dual-core 32-bit powerhouse. WiFi + Bluetooth built in. Handles audio, IoT, control loops. Default for anything demanding.",
    costRank: 6
  },
  {
    key: "esp8266-nodemcu",
    displayName: "ESP8266 NodeMCU",
    wokwiPartType: "",
    usableGpio: 11,
    peripherals: { i2c: 1, spi: 1, uart: 1, pwm: 4, adc: 1 },
    flashKB: 4096, ramKB: 80,
    voltage: "3.3V",
    realtimeCapable: true,
    connectivity: { wifi: true, bluetooth: false },
    clockMHz: 80,
    note: "Cheap WiFi board. No Bluetooth. Few pins, 1 ADC. Not reliably simulatable in Wokwi.",
    costRank: 5
  },
  {
    key: "raspberry-pi-pico",
    displayName: "Raspberry Pi Pico (RP2040)",
    wokwiPartType: "wokwi-pi-pico",
    usableGpio: 26,
    peripherals: { i2c: 2, spi: 2, uart: 2, pwm: 16, adc: 3 },
    flashKB: 2048, ramKB: 264,
    voltage: "3.3V",
    realtimeCapable: true,
    connectivity: { wifi: false, bluetooth: false },
    clockMHz: 133,
    note: "Dual-core 32-bit, fast, lots of RAM. No wireless on base model. Good for control loops and audio.",
    costRank: 2
  },
  {
    key: "raspberry-pi-pico-w",
    displayName: "Raspberry Pi Pico W (RP2040)",
    wokwiPartType: "wokwi-pi-pico-w",
    usableGpio: 26,
    peripherals: { i2c: 2, spi: 2, uart: 2, pwm: 16, adc: 3 },
    flashKB: 2048, ramKB: 264,
    voltage: "3.3V",
    realtimeCapable: true,
    connectivity: { wifi: true, bluetooth: true },
    clockMHz: 133,
    note: "Pico with WiFi + Bluetooth. Good middle ground when you need wireless + processing power.",
    costRank: 3
  }
];
