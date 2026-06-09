import { listAllComponents } from '../repositories/component.repository.js'
import { getLatestSnapshot, createSnapshot } from '../repositories/registrySnapshot.repository.js'
import { getLatestVersionsByComponentIds } from '../repositories/componentVersion.repository.js'
import { buildRegistryEntry } from '../registry/registryBuilder.js'
import { sha256Hex } from '../utils/hash.js'
import { stableStringify } from '../utils/stableStringify.js'

export async function generateRegistrySnapshot() {
  const [latestSnapshot, components] = await Promise.all([getLatestSnapshot(), listAllComponents()])

  const snapshotVersion = (latestSnapshot?.version ?? 0) + 1
  const generatedAt = new Date().toISOString()

  const componentIds = components.map((c) => String(c._id))
  const latestById =
    componentIds.length > 0 ? await getLatestVersionsByComponentIds(componentIds) : new Map()

  const entries = components.map((c) => {
    const latest = latestById.get(String(c._id))
    if (latest?.registryEntry) return latest.registryEntry

    return buildRegistryEntry({
      partNumber: c.partNumber,
      manufacturer: c.manufacturer,
      name: c.name,
      family: c.family,
      category: c.category,
      wokwiType: c.wokwiType,
      pins: c.pins ?? [],
      configDefaults: c.configDefaults ?? {},
      runtimeDefaults: c.runtimeDefaults ?? {},
      version: 1,
      timestamp: generatedAt,
    })
  })

  entries.sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const registry = { version: snapshotVersion, generatedAt, entries }
  const checksumSha256 = sha256Hex(stableStringify(registry))

  const saved = await createSnapshot({
    version: snapshotVersion,
    checksumSha256,
    entryCount: entries.length,
    registry,
  })

  return saved
}

