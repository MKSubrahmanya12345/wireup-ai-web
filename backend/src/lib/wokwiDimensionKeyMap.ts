// ??$$$ group 5 - Circuit Simulation (Phase 4)
// @ts-nocheck
// ??$$$ FORGE: wokwiDimensionKeyMap.js — Maps Wokwi part types → dimension DB keys
// Solves the silent mismatch: AI outputs wokwiPartType, assembly needs dimension DB key.

const WOKWI_TO_DIMENSION_KEY = {
  // Controllers
  'wokwi-esp32-devkit-v1':      'ESP32_DEVKIT_V1',
  'wokwi-arduino-uno':          'ARDUINO_UNO',
  'wokwi-arduino-mega':         'ARDUINO_MEGA',
  'wokwi-arduino-nano':         'ARDUINO_NANO',
  'wokwi-raspberry-pi-pico':    'RASPBERRY_PI_PICO',

  // Sensors
  'wokwi-pir-motion-sensor':    'PIR_HC_SR501',
  'wokwi-hc-sr04':              'ULTRASONIC_HC_SR04',
  'wokwi-dht22':                'DHT22',
  'wokwi-dht11':                'DHT11',  // commonly mislabeled
  'wokwi-mpu6050':              'MPU6050',
  'wokwi-photoresistor':        'LDR_5MM',
  'wokwi-soil-moisture':        'SOIL_MOISTURE_SENSOR',

  // Outputs / Actuators
  'wokwi-servo':                'SERVO_SG90',
  'wokwi-relay':                'RELAY_5V_SINGLE',

  // Displays
  'wokwi-ssd1306':              'OLED_128X64_I2C',
  'wokwi-lcd1602':              'LCD_16X2',
  'wokwi-7segment':             'SEVEN_SEGMENT_4DIGIT',

  // Passives
  'wokwi-led':                  'LED_5MM',
  'wokwi-buzzer':               'BUZZER_5V',
  'wokwi-pushbutton':           'PUSH_BUTTON',
  'wokwi-potentiometer':        'POT_10K',
  'wokwi-resistor':             'RESISTOR',
  'wokwi-capacitor':            'CAPACITOR_100UF',
  'wokwi-breadboard':           'BREADBOARD_HALF',

  // Additional aliases — AI sometimes uses these
  'esp32':                      'ESP32_DEVKIT_V1',
  'arduino-uno':                'ARDUINO_UNO',
  'arduino-mega':               'ARDUINO_MEGA',
  'arduino-nano':               'ARDUINO_NANO',
  'pir':                        'PIR_HC_SR501',
  'hc-sr501':                   'PIR_HC_SR501',
  'hc-sr04':                    'ULTRASONIC_HC_SR04',
  'dht22':                      'DHT22',
  'dht11':                      'DHT11',
  'servo':                      'SERVO_SG90',
  'led':                        'LED_5MM',
  'buzzer':                     'BUZZER_5V',
  'button':                     'PUSH_BUTTON',
  'relay':                      'RELAY_5V_SINGLE',
  'oled':                       'OLED_128X64_I2C',
  'lcd':                        'LCD_16X2',
  'wokwi-stepper-motor':        'STEPPER_MOTOR_NEMA17',
  'wokwi-a4988':                'A4988_STEPPER_DRIVER',
  'stepper':                    'STEPPER_MOTOR_NEMA17',
  'a4988':                      'A4988_STEPPER_DRIVER',
};

/**
 * resolveDimensionKey(wokwiPartType, bomKey)
 * Resolves the dimension DB key from a wokwi part type or BOM key.
 * Falls back to bomKey if no wokwi mapping found.
 * @param {string} wokwiPartType
 * @param {string} bomKey - the BOM item's .key field
 * @returns {string} dimension DB key
 */
export const resolveDimensionKey = (wokwiPartType, bomKey) => {
  if (wokwiPartType) {
    const lower = String(wokwiPartType).toLowerCase().trim();
    if (WOKWI_TO_DIMENSION_KEY[lower]) return WOKWI_TO_DIMENSION_KEY[lower];
    if (WOKWI_TO_DIMENSION_KEY[lower.replace('wokwi-', '')]) {
      return WOKWI_TO_DIMENSION_KEY[lower.replace('wokwi-', '')];
    }
  }
  // Fall back to BOM key directly (may already match dimension DB)
  if (bomKey && WOKWI_TO_DIMENSION_KEY[bomKey]) return WOKWI_TO_DIMENSION_KEY[bomKey];
  return bomKey || 'UNKNOWN';
};

export { WOKWI_TO_DIMENSION_KEY };
export default { resolveDimensionKey, WOKWI_TO_DIMENSION_KEY };
