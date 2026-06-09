import { COMPONENT_FAMILIES, FAMILY_TO_CATEGORY } from '../domain/families.js'

export function validateRegistryEntry(entry) {
  const errors = []
  const warnings = []

  if (!entry || typeof entry !== 'object') {
    return { ok: false, errors: [{ code: 'INVALID', message: 'Entry must be an object' }], warnings }
  }

  const required = ['id', 'family', 'category', 'name', 'manufacturer', 'partNumber']
  for (const key of required) {
    if (!String(entry[key] ?? '').trim()) errors.push({ code: 'REQUIRED', field: key, message: `${key} is required` })
  }

  if (entry.family && !COMPONENT_FAMILIES.includes(entry.family)) {
    errors.push({ code: 'INVALID_FAMILY', field: 'family', message: `Unknown family: ${entry.family}` })
  }

  if (entry.family && entry.category) {
    const expected = FAMILY_TO_CATEGORY[entry.family]
    if (expected && entry.category !== expected) {
      warnings.push({
        code: 'CATEGORY_MISMATCH',
        field: 'category',
        message: `Category differs from default for family (${expected})`,
      })
    }
  }

  const pins = Array.isArray(entry.pins) ? entry.pins : []
  const seenNumbers = new Set()
  const seenNames = new Set()

  for (const [idx, p] of pins.entries()) {
    const number = String(p?.number ?? '').trim()
    const name = String(p?.name ?? '').trim()
    const type = String(p?.type ?? '').trim()

    if (!number) errors.push({ code: 'PIN_REQUIRED', field: `pins.${idx}.number`, message: 'Pin number required' })
    if (!name) errors.push({ code: 'PIN_REQUIRED', field: `pins.${idx}.name`, message: 'Pin name required' })
    if (!type) errors.push({ code: 'PIN_REQUIRED', field: `pins.${idx}.type`, message: 'Pin type required' })

    if (number) {
      const key = number.toLowerCase()
      if (seenNumbers.has(key)) errors.push({ code: 'DUPLICATE_PIN', field: `pins.${idx}.number`, message: `Duplicate pin number ${number}` })
      seenNumbers.add(key)
    }
    if (name) {
      const key = name.toLowerCase()
      if (seenNames.has(key)) warnings.push({ code: 'DUPLICATE_PIN_NAME', field: `pins.${idx}.name`, message: `Duplicate pin name ${name}` })
      seenNames.add(key)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

