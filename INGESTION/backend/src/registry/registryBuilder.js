import { slugify } from '../utils/slugify.js'
import { sha256Hex } from '../utils/hash.js'
import { stableStringify } from '../utils/stableStringify.js'
import { FAMILY_TO_CATEGORY } from '../domain/families.js'
import { generateConfigDefaults, generateRuntimeDefaults } from './defaults.js'

export function buildRegistryEntry(input) {
  const manufacturer = String(input.manufacturer ?? '').trim()
  const partNumber = String(input.partNumber ?? '').trim()
  const family = input.family
  const category = input.category ?? FAMILY_TO_CATEGORY[family] ?? ''
  const name = String(input.name ?? partNumber).trim()

  const idBase = slugify(`${manufacturer || 'unknown'}-${partNumber}`)
  const version = Number.isInteger(input.version) ? input.version : 1
  const timestamp = input.timestamp ? String(input.timestamp) : new Date().toISOString()
  const pins = Array.isArray(input.pins) ? input.pins : []
  const configDefaults = input.configDefaults ?? generateConfigDefaults(family)
  const runtimeDefaults = input.runtimeDefaults ?? generateRuntimeDefaults(family)

  const withoutChecksum = {
    id: idBase,
    family,
    category,
    name,
    manufacturer: manufacturer || 'Unknown',
    partNumber,
    wokwiType: input.wokwiType ?? '',
    pins,
    configDefaults,
    runtimeDefaults,
    version,
    timestamp,
  }

  const checksumSha256 = sha256Hex(stableStringify(withoutChecksum))
  return { ...withoutChecksum, checksumSha256 }
}
