import { ComponentSearchProvider } from './types.js'

export class ManualProvider extends ComponentSearchProvider {
  constructor() {
    super('manual')
  }

  async search(input) {
    const pn = String(input.partNumber ?? '').trim()
    const upper = pn.toUpperCase()

    const known = {
      MG90S: { manufacturer: 'TowerPro', name: 'MG90S Micro Servo' },
      'HC-SR04': { manufacturer: 'Generic', name: 'HC-SR04 Ultrasonic Sensor' },
      ESP32: { manufacturer: 'Espressif', name: 'ESP32 WiFi/Bluetooth SoC' },
      A4988: { manufacturer: 'Allegro', name: 'A4988 Stepper Motor Driver' },
    }

    const base = known[upper] ?? {}

    return {
      provider: this.name,
      partNumber: pn,
      manufacturer: base.manufacturer ?? '',
      name: base.name ?? pn,
      description: '',
      datasheetUrl: input.datasheetUrl ?? '',
      imageUrl: '',
      metadata: { manual: true },
    }
  }
}

