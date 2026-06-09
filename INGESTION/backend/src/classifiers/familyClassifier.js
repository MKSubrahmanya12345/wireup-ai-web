import { COMPONENT_FAMILIES } from '../domain/families.js'

const RULES = [
  { family: 'SERVO', weight: 8, match: /\bservo\b/i },
  { family: 'SERVO', weight: 10, match: /\bmg90s\b/i },
  { family: 'ULTRASONIC', weight: 10, match: /\bhc-?sr04\b/i },
  { family: 'ULTRASONIC', weight: 8, match: /\bultrasonic\b/i },
  { family: 'CONTROLLER', weight: 10, match: /\besp32\b/i },
  { family: 'CONTROLLER', weight: 8, match: /\b(microcontroller|mcu|soc)\b/i },
  { family: 'STEPPER_DRIVER', weight: 10, match: /\ba4988\b/i },
  { family: 'STEPPER_DRIVER', weight: 8, match: /\b(stepper driver|microstep|current regulator)\b/i },
  { family: 'WIFI_MODULE', weight: 8, match: /\b(wifi|802\.11)\b/i },
  { family: 'BLUETOOTH', weight: 8, match: /\bbluetooth\b/i },
  { family: 'GPS', weight: 8, match: /\bgps\b/i },
  { family: 'RELAY', weight: 8, match: /\brelay\b/i },
  { family: 'BUZZER', weight: 8, match: /\b(buzzer|piezo)\b/i },
  { family: 'LED', weight: 6, match: /\bled\b/i },
  { family: 'RGB_LED', weight: 8, match: /\brgb\b/i },
  { family: 'LCD', weight: 8, match: /\blcd\b/i },
  { family: 'OLED', weight: 8, match: /\boled\b/i },
  { family: 'SEVEN_SEGMENT', weight: 8, match: /\b(7-?segment|seven segment)\b/i },
  { family: 'BUTTON', weight: 6, match: /\b(push button|tactile)\b/i },
  { family: 'TOGGLE_SWITCH', weight: 6, match: /\btoggle\b/i },
  { family: 'DIP_SWITCH', weight: 6, match: /\bdip switch\b/i },
  { family: 'ROTARY_ENCODER', weight: 8, match: /\b(rotary encoder|quadrature)\b/i },
  { family: 'POTENTIOMETER', weight: 8, match: /\bpotentiometer\b/i },
  { family: 'JOYSTICK', weight: 8, match: /\bjoystick\b/i },
  { family: 'KEYPAD', weight: 8, match: /\bkeypad\b/i },
  { family: 'IR_RECEIVER', weight: 8, match: /\bir receiver\b/i },
  { family: 'IR_TRANSMITTER', weight: 8, match: /\bir transmitter\b/i },
  { family: 'DHT11', weight: 10, match: /\bdht11\b/i },
  { family: 'DHT22', weight: 10, match: /\bdht22\b/i },
  { family: 'BME280', weight: 10, match: /\bbme280\b/i },
  { family: 'BMP280', weight: 10, match: /\bbmp280\b/i },
  { family: 'MQ_SENSOR', weight: 8, match: /\bmq-\d+\b/i },
  { family: 'PIR_SENSOR', weight: 8, match: /\bpir\b/i },
  { family: 'LDR', weight: 8, match: /\bldr\b/i },
  { family: 'RTC', weight: 8, match: /\brtc\b/i },
  { family: 'EEPROM', weight: 8, match: /\beeprom\b/i },
  { family: 'SD_CARD', weight: 8, match: /\bsd card\b/i },
  { family: 'RFID', weight: 8, match: /\brfid\b/i },
  { family: 'NFC', weight: 8, match: /\bnfc\b/i },
  { family: 'LORA', weight: 8, match: /\blora\b/i },
  { family: 'NRF24', weight: 10, match: /\bnrf24\b/i },
  { family: 'CAN_MODULE', weight: 8, match: /\bcan\b/i },
  { family: 'RS485', weight: 8, match: /\brs-?485\b/i },
  { family: 'I2C_EXPANDER', weight: 8, match: /\b(i2c expander|pcf8574|mcp23017)\b/i },
  { family: 'SHIFT_REGISTER', weight: 8, match: /\b(shift register|74hc595)\b/i },
  { family: 'MOTOR_DRIVER', weight: 8, match: /\b(motor driver|h-bridge|l298n|tb6612)\b/i },
  { family: 'STEPPER', weight: 6, match: /\bstepper motor\b/i },
  { family: 'DC_MOTOR', weight: 6, match: /\bdc motor\b/i },
  { family: 'MOSFET', weight: 8, match: /\bmosfet\b/i },
  { family: 'TRANSISTOR', weight: 8, match: /\btransistor\b/i },
  { family: 'OPAMP', weight: 8, match: /\b(opamp|operational amplifier)\b/i },
  { family: 'ADC', weight: 8, match: /\banalog to digital|adc\b/i },
  { family: 'DAC', weight: 8, match: /\bdac\b/i },
  { family: 'POWER_REGULATOR', weight: 8, match: /\b(regulator|buck|boost|ldo)\b/i },
  { family: 'BATTERY', weight: 8, match: /\bbattery\b/i },
]

export function classifyFamily(input) {
  const hay = [
    input.partNumber ?? '',
    input.title ?? '',
    input.name ?? '',
    input.description ?? '',
    input.datasheetText ?? '',
  ]
    .join('\n')
    .slice(0, 250_000)

  const scoreByFamily = new Map()
  for (const fam of COMPONENT_FAMILIES) scoreByFamily.set(fam, 0)

  for (const rule of RULES) {
    if (rule.match.test(hay)) {
      scoreByFamily.set(rule.family, (scoreByFamily.get(rule.family) ?? 0) + rule.weight)
    }
  }

  let best = { family: null, score: 0 }
  for (const [family, score] of scoreByFamily.entries()) {
    if (score > best.score) best = { family, score }
  }

  return best.family
}

