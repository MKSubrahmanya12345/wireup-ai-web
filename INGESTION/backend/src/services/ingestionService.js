import { getProvider } from '../providers/providerRegistry.js'
import { processDatasheet } from '../parsers/datasheetProcessor.js'
import { extractPinsFromText } from '../parsers/pinExtractor.js'
import { classifyFamily } from '../classifiers/familyClassifier.js'
import { FAMILY_TO_CATEGORY } from '../domain/families.js'
import { buildRegistryEntry } from '../registry/registryBuilder.js'
import { validateRegistryEntry } from '../validators/registryValidator.js'
import { findComponentByKey, upsertComponentByKey } from '../repositories/component.repository.js'
import {
  createComponentVersion,
  getLatestComponentVersion,
} from '../repositories/componentVersion.repository.js'
import { generateRegistrySnapshot } from './registrySnapshotService.js'
import { sha256Hex } from '../utils/hash.js'
import { stableStringify } from '../utils/stableStringify.js'

export async function searchComponent(input) {
  const provider = getProvider(input.provider)
  const providerResult = await provider.search({
    partNumber: input.partNumber,
    datasheetUrl: input.datasheetUrl,
  })

  const datasheetUrl = providerResult.datasheetUrl || input.datasheetUrl || ''
  let datasheet = null
  let extractedPins = []

  if (datasheetUrl) {
    datasheet = await processDatasheet(datasheetUrl)
    extractedPins = extractPinsFromText(datasheet.text)
  }

  const family =
    classifyFamily({
      partNumber: providerResult.partNumber,
      title: datasheet?.title ?? '',
      name: providerResult.name ?? '',
      description: providerResult.description ?? '',
      datasheetText: datasheet?.text ?? '',
    }) ?? null

  const category = family ? FAMILY_TO_CATEGORY[family] : ''

  return {
    provider: providerResult.provider,
    partNumber: providerResult.partNumber,
    manufacturer: providerResult.manufacturer ?? '',
    name: providerResult.name ?? '',
    description: providerResult.description ?? '',
    datasheetUrl,
    imageUrl: providerResult.imageUrl ?? '',
    metadata: providerResult.metadata ?? {},
    datasheet,
    extracted: {
      family,
      category,
      pins: extractedPins,
    },
  }
}

export async function generateRegistryFromDraft(draft) {
  const family = draft.family
  const entry = buildRegistryEntry({
    ...draft,
    family,
    category: draft.category ?? (family ? FAMILY_TO_CATEGORY[family] : ''),
  })

  const validation = validateRegistryEntry(entry)
  return { entry, validation }
}

export async function importComponent(input) {
  let datasheet = null
  let extractedPins = []

  if (input.datasheetUrl) {
    datasheet = await processDatasheet(input.datasheetUrl)
    extractedPins = extractPinsFromText(datasheet.text)
  }

  const family =
    input.family ??
    classifyFamily({
      partNumber: input.partNumber,
      title: datasheet?.title ?? '',
      name: input.name ?? '',
      description: input.description ?? '',
      datasheetText: datasheet?.text ?? '',
    })

  const category = input.category ?? (family ? FAMILY_TO_CATEGORY[family] : '')
  const pins = input.pins ?? extractedPins

  const manufacturer = input.manufacturer ?? ''
  const name = input.name ?? ''
  const description = input.description ?? ''

  const existing = await getExistingForVersion(input.partNumber, manufacturer)
  const nextVersion = (existing?.version ?? 0) + 1

  const { entry, validation } = await generateRegistryFromDraft({
    ...input,
    manufacturer,
    name,
    description,
    family,
    category,
    pins,
    version: nextVersion,
  })

  if (!validation.ok) {
    return { ok: false, validation }
  }

  const componentDoc = await upsertComponentByKey({
    partNumber: input.partNumber,
    manufacturer,
    name: entry.name,
    description,
    family: entry.family,
    category: entry.category,
    datasheetUrl: input.datasheetUrl ?? '',
    imageUrl: input.imageUrl ?? '',
    wokwiType: input.wokwiType ?? '',
    pins: entry.pins ?? [],
    configDefaults: entry.configDefaults ?? {},
    runtimeDefaults: entry.runtimeDefaults ?? {},
    metadata: {
      ...(input.metadata ?? {}),
      provider: input.provider ?? 'manual',
      datasheet: datasheet
        ? { url: datasheet.url, kind: datasheet.kind, title: datasheet.title, metadata: datasheet.metadata ?? {} }
        : null,
    },
  })

  const checksumSha256 = sha256Hex(stableStringify(entry))
  await createComponentVersion({
    componentId: String(componentDoc._id),
    version: nextVersion,
    registryEntry: entry,
    checksumSha256,
  })

  const snapshot = await generateRegistrySnapshot()

  return {
    ok: true,
    componentId: String(componentDoc._id),
    version: nextVersion,
    entry,
    snapshot: { version: snapshot.version, checksumSha256: snapshot.checksumSha256, entryCount: snapshot.entryCount },
  }
}

async function getExistingForVersion(partNumber, manufacturer) {
  const existingComp = await findComponentByKey(partNumber, manufacturer ?? '')
  if (!existingComp) return null
  return getLatestComponentVersion(String(existingComp._id))
}
