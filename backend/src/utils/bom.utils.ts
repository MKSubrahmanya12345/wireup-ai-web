// ??$$$ group 3 - Components BOM & Wiring (Phase 2)
// @ts-nocheck
export const deriveBOMKey = (name = '') => {
  const n = name.toLowerCase();
  if (/arduino uno/i.test(n)) return 'ARDUINO_UNO';
  if (/arduino mega/i.test(n)) return 'ARDUINO_MEGA';
  if (/arduino nano/i.test(n)) return 'ARDUINO_NANO';
  if (/esp32/i.test(n)) return 'ESP32_DEVKIT_V1';
  if (/pir/i.test(n)) return 'PIR_HC_SR501';
  if (/ultrasonic/i.test(n)) return 'ULTRASONIC_HC_SR04';
  if (/dht11/i.test(n)) return 'DHT11';
  if (/dht22/i.test(n)) return 'DHT22';
  if (/oled/i.test(n)) return 'OLED_128X64_I2C';
  if (/lcd/i.test(n)) return 'LCD_16X2';
  if (/servo/i.test(n)) return 'SERVO_SG90';
  if (/relay/i.test(n)) return 'RELAY_5V_SINGLE';
  if (/buzzer/i.test(n)) return 'BUZZER_5V';
  if (/\bled\b/i.test(n)) return 'LED_5MM';
  if (/button|pushbutton/i.test(n)) return 'PUSH_BUTTON';
  if (/resistor/i.test(n)) return 'RESISTOR';
  if (/potentiometer|pot\b/i.test(n)) return 'POT_10K';
  if (/breadboard/i.test(n)) return 'BREADBOARD_HALF';
  if (/jumper|wire/i.test(n)) return 'jumper wires';
  if (/l298|motor driver/i.test(n)) return 'L298N_MOTOR_DRIVER';
  if (/mpu6050|gyro/i.test(n)) return 'MPU6050';
  return name.toUpperCase().replace(/\s+/g, '_');
};
