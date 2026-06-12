import { getDiscoveryProviders } from '../discovery/providerRegistry.js'
import { classifyFamily } from '../classifiers/familyClassifier.js'
import { FAMILY_TO_CATEGORY } from '../domain/families.js'
import { buildRegistryEntry } from '../registry/registryBuilder.js'
import { validateRegistryEntry } from '../validators/registryValidator.js'
import { upsertCandidate } from '../repositories/registryCandidate.repository.js'
import { getScanPaused } from './settingsService.js'

export async function runDiscoveryScan() {
  const paused = await getScanPaused()
  if (paused) {
    return { skipped: true, reason: 'paused', discovered: 0, candidatesUpserted: 0 }
  }

  const providers = getDiscoveryProviders()
  const discoveries = []

  for (const provider of providers) {
    const found = await provider.discover()
    for (const item of found) {
      discoveries.push({ ...item, provider: provider.name })
    }
  }

  const upserted = []
  for (const d of discoveries) {
    const family =
      classifyFamily({
        partNumber: d.partNumber,
        title: d.name ?? '',
        name: d.name ?? '',
        description: d.description ?? '',
        datasheetText: '',
      }) ?? null

    const category = family ? FAMILY_TO_CATEGORY[family] : ''
    const pins = (d.pins ?? []).map((p) => ({
      number: String(p.number ?? '').trim(),
      name: String(p.name ?? '').trim(),
      type: 'OTHER',
      description: '',
      busCapabilities: [],
    }))

    const draft = {
      provider: d.provider,
      partNumber: d.partNumber,
      datasheetUrl: d.datasheetUrl || undefined,
      manufacturer: '',
      name: d.name ?? d.partNumber,
      description: d.description ?? '',
      family: family ?? undefined,
      category: category || undefined,
      imageUrl: '',
      wokwiType: '',
      pins,
      configDefaults: {},
      runtimeDefaults: {},
      metadata: {
        source: d.source,
        sourceRef: d.sourceRef,
        footprint: d.footprint ?? '',
        raw: d.raw ?? {},
      },
    }

    if (!draft.family) continue

    const generatedEntry = buildRegistryEntry({
      ...draft,
      family: draft.family,
      category: draft.category,
      pins: draft.pins,
      configDefaults: draft.configDefaults,
      runtimeDefaults: draft.runtimeDefaults,
    })

    const validation = validateRegistryEntry(generatedEntry)

    const doc = await upsertCandidate({
      status: 'pending',
      source: d.source,
      sourceRef: d.sourceRef,
      partNumber: d.partNumber,
      draft,
      generatedEntry,
      validation,
      approvedComponentId: null,
      approvedVersion: null,
      rejectedReason: '',
    })

    upserted.push(doc)
  }

  return {
    discovered: discoveries.length,
    candidatesUpserted: upserted.length,
  }
}
