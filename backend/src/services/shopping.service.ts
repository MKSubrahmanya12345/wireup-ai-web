// @ts-nocheck
// ??$$$ FORGE: shopping.service.js — Static price catalog and jugaad substitutions
import { resolveDimensionKey } from '../lib/wokwiDimensionKeyMap';

// Static catalog. In production, this would poll the Robu.in API.
// Jugaad = DIY or household alternative to save money.
const CATALOG = {
  // Controllers
  ESP32_DEVKIT_V1:   { price: 450, storeUrl: 'https://robu.in/product/esp32-development-board/' },
  ARDUINO_UNO:       { price: 550, storeUrl: 'https://robu.in/product/arduino-uno-r3-ch340g-atmega328p/' },
  ARDUINO_MEGA:      { price: 950, storeUrl: 'https://robu.in/product/arduino-mega-2560-r3/' },
  ARDUINO_NANO:      { price: 300, storeUrl: 'https://robu.in/product/arduino-nano-v3-0-ch340-chip/' },
  NODEMCU_ESP8266:   { price: 250, storeUrl: 'https://robu.in/product/nodemcu-esp8266-wifi-development-board/' },
  RASPBERRY_PI_PICO: { price: 350, storeUrl: 'https://robu.in/product/raspberry-pi-pico/' },

  // Sensors
  PIR_HC_SR501:      { price: 85,  storeUrl: 'https://robu.in/product/hc-sr501-pir-motion-sensor-module/' },
  ULTRASONIC_HC_SR04:{ price: 75,  storeUrl: 'https://robu.in/product/hc-sr04-ultrasonic-range-finder/' },
  DHT11:             { price: 90,  storeUrl: 'https://robu.in/product/dht11-temperature-and-humidity-sensor/' },
  DHT22:             { price: 250, storeUrl: 'https://robu.in/product/dht22-digital-temperature-and-humidity-sensor/' },
  LDR_5MM:           { price: 5,   storeUrl: 'https://robu.in/product/5mm-ldr-light-dependent-resistor/' },
  SOIL_MOISTURE_SENSOR: { 
    price: 60, storeUrl: 'https://robu.in/product/soil-moisture-sensor-module/',
    jugaad: { displayName: '2 Galvanized Nails + Wire', price: 5 }
  },
  MQ2_GAS_SENSOR:    { price: 120, storeUrl: 'https://robu.in/product/mq-2-gas-sensor-module/' },
  RAIN_SENSOR:       { price: 80,  storeUrl: 'https://robu.in/product/rain-water-sensor-module/' },
  MPU6050:           { price: 150, storeUrl: 'https://robu.in/product/mpu6050-6-axis-accelerometer-and-gyro/' },

  // Actuators
  RELAY_5V_SINGLE:   { price: 65,  storeUrl: 'https://robu.in/product/5v-1-channel-relay-module/' },
  SERVO_SG90:        { price: 110, storeUrl: 'https://robu.in/product/towerpro-sg90-9g-micro-servo-motor/' },
  L298N_MOTOR_DRIVER:{ price: 130, storeUrl: 'https://robu.in/product/l298n-2a-based-motor-driver-module/' },

  // Displays
  OLED_128X64_I2C:   { price: 280, storeUrl: 'https://robu.in/product/0-96-inch-i2c-oled-display-module/' },
  LCD_16X2:          { price: 140, storeUrl: 'https://robu.in/product/16x2-character-lcd-display/' },

  // Passives / Misc
  LED_5MM:           { price: 2,   storeUrl: 'https://robu.in/product/5mm-led-red/' },
  BUZZER_5V:         { price: 15,  storeUrl: 'https://robu.in/product/5v-active-buzzer/' },
  PUSH_BUTTON:       { price: 5,   storeUrl: 'https://robu.in/product/tactile-push-button-switch/' },
  POT_10K:           { price: 10,  storeUrl: 'https://robu.in/product/10k-potentiometer/' },
  RESISTOR:          { price: 1,   storeUrl: 'https://robu.in/product/resistor-pack/' },
  BREADBOARD_HALF:   { 
    price: 65, storeUrl: 'https://robu.in/product/400-tie-point-interlocking-solderless-breadboard/',
    jugaad: { displayName: 'Direct Soldering / Cardboard base', price: 0 }
  },

  // Generic fallbacks for common names
  'jumper wires':    { price: 60, storeUrl: 'https://robu.in/product/jump-wire-male-to-male-40pcs/', jugaad: { displayName: 'Old ethernet/ethernet cable wires', price: 0 } },
  'battery holder':  { price: 25, storeUrl: 'https://robu.in/product/2-x-18650-battery-holder/', jugaad: { displayName: 'Tape + wires', price: 0 } },
};

/**
 * processBOMForShopping(bom)
 * Adds price, storeUrl, and jugaad alternatives to BOM items.
 */
export const processBOMForShopping = (bom) => {
  if (!bom || !Array.isArray(bom)) return [];

  return bom.map(item => {
    // Attempt to match by exact key, dimension key, or name
    const dimKey = resolveDimensionKey(null, item.key);
    let catalogEntry = CATALOG[item.key] || CATALOG[dimKey] || CATALOG[item.displayName?.toLowerCase()] || null;

    return {
      key: item.key,
      displayName: item.displayName || item.key,
      qty: item.qty || 1,
      price: catalogEntry ? catalogEntry.price : (item.price || 50), // fallback fake price if unknown
      storeUrl: catalogEntry ? catalogEntry.storeUrl : '',
      jugaad: catalogEntry?.jugaad || null,
    };
  });
};

export default { processBOMForShopping };
