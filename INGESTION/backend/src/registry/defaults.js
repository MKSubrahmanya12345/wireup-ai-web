export function generateConfigDefaults(family) {
  switch (family) {
    case 'SERVO':
      return { minPulseUs: 500, maxPulseUs: 2500, frequencyHz: 50 }
    case 'ULTRASONIC':
      return { maxDistanceCm: 400 }
    case 'STEPPER_DRIVER':
      return { microsteps: 16, currentLimitA: 1.0 }
    case 'LED':
    case 'RGB_LED':
      return { brightness: 1.0 }
    default:
      return {}
  }
}

export function generateRuntimeDefaults(family) {
  switch (family) {
    case 'SERVO':
      return { angle: 0 }
    case 'ULTRASONIC':
      return { distanceCm: 0 }
    case 'LED':
      return { on: false }
    case 'RGB_LED':
      return { r: 0, g: 0, b: 0 }
    default:
      return {}
  }
}

