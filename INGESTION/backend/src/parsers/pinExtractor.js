const BUS_KEYWORDS = [
  { key: 'I2C', match: /\b(i2c|sda|scl)\b/i },
  { key: 'SPI', match: /\b(spi|mosi|miso|sck|cs|ss)\b/i },
  { key: 'UART', match: /\b(uart|txd|rxd|tx|rx)\b/i },
  { key: 'PWM', match: /\b(pwm)\b/i },
  { key: 'ADC', match: /\b(adc|ain|analog)\b/i },
  { key: 'DAC', match: /\b(dac)\b/i },
  { key: 'CLK', match: /\b(clk|clock)\b/i },
]

export function extractPinsFromText(text) {
  const lines = String(text ?? '')
    .split('\n')
    .map((l) => l.trim())

  const candidates = []
  for (const line of lines) {
    const m = line.match(/^(\d+)\s+([A-Za-z0-9_\/\-\.\+]+)\s*(.*)$/)
    if (!m) continue
    const number = m[1]
    const name = m[2]
    const description = (m[3] ?? '').trim()
    if (name.length > 24) continue
    if (!/[A-Za-z]/.test(name)) continue
    candidates.push({
      number,
      name,
      type: inferPinType(name, description),
      description,
      busCapabilities: inferBusCaps(name, description),
    })
  }

  const unique = new Map()
  for (const p of candidates) {
    const key = `${p.number}:${p.name}`.toLowerCase()
    if (!unique.has(key)) unique.set(key, p)
  }

  return Array.from(unique.values()).slice(0, 200)
}

function inferPinType(name, description) {
  const s = `${name} ${description}`.toLowerCase()
  if (/\b(gnd|ground)\b/.test(s)) return 'GND'
  if (/\b(vcc|vdd|3v3|5v|vin|vbat|vref)\b/.test(s)) return 'VCC'
  if (/\b(rst|reset|nrst)\b/.test(s)) return 'RST'
  if (/\b(en|enable|chip_en|cen)\b/.test(s)) return 'EN'
  if (/\b(clk|clock)\b/.test(s)) return 'CLK'
  if (/\b(sda|scl|i2c)\b/.test(s)) return 'I2C'
  if (/\b(mosi|miso|sck|ss|cs|spi)\b/.test(s)) return 'SPI'
  if (/\b(tx|rx|txd|rxd|uart)\b/.test(s)) return 'UART'
  if (/\b(pwm)\b/.test(s)) return 'PWM'
  if (/\b(adc|ain|analog)\b/.test(s)) return 'ADC'
  if (/\b(dac)\b/.test(s)) return 'DAC'
  if (/\b(nc|no connect)\b/.test(s)) return 'NC'
  if (/\b(gpio|io\d+|d\d+)\b/.test(s)) return 'GPIO'
  return 'OTHER'
}

function inferBusCaps(name, description) {
  const s = `${name} ${description}`
  const caps = []
  for (const rule of BUS_KEYWORDS) {
    if (rule.match.test(s)) caps.push(rule.key)
  }
  return Array.from(new Set(caps))
}

