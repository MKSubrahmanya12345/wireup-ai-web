import { SearchRequestSchema, ImportRequestSchema, GenerateRegistryRequestSchema, ValidateRequestSchema } from '../schemas/componentSchemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { createJob, completeJob, failJob, listJobs } from '../repositories/ingestionJob.repository.js'
import { listComponents, getComponentById } from '../repositories/component.repository.js'
import { searchComponent, importComponent, generateRegistryFromDraft } from '../services/ingestionService.js'
import { validateRegistryEntry } from '../validators/registryValidator.js'
import { runDiscoveryScan } from '../services/discoveryScanService.js'
import { exportRegistryToFile } from '../services/registryExportService.js'
import { getCandidates, approveCandidate, rejectCandidate } from '../services/candidateService.js'
import { getScanPaused, setScanPaused } from '../services/settingsService.js'

export const ingestionSearch = asyncHandler(async (req, res) => {
  const input = SearchRequestSchema.parse(req.body ?? {})
  const job = await createJob('search', input)
  try {
    const output = await searchComponent(input)
    await completeJob(String(job._id), output)
    res.json({ ok: true, result: output, jobId: String(job._id) })
  } catch (err) {
    await failJob(String(job._id), serializeError(err))
    throw err
  }
})

export const ingestionGenerateRegistry = asyncHandler(async (req, res) => {
  const input = GenerateRegistryRequestSchema.parse(req.body ?? {})
  const draft = input.entry ?? {}
  if (!draft.family) {
    return res.status(400).json({ ok: false, error: { message: 'family is required to generate registry entry' } })
  }
  const output = await generateRegistryFromDraft(draft)
  res.json({ ok: true, ...output })
})

export const ingestionValidate = asyncHandler(async (req, res) => {
  const input = ValidateRequestSchema.parse(req.body ?? {})
  const validation = validateRegistryEntry(input.entry)
  res.json({ ok: true, validation })
})

export const ingestionImport = asyncHandler(async (req, res) => {
  const input = ImportRequestSchema.parse(req.body ?? {})
  const job = await createJob('import', input)
  try {
    const output = await importComponent(input)
    await completeJob(String(job._id), output)
    res.status(output.ok ? 200 : 400).json({ ...output, jobId: String(job._id) })
  } catch (err) {
    await failJob(String(job._id), serializeError(err))
    throw err
  }
})

export const ingestionJobs = asyncHandler(async (_req, res) => {
  const jobs = await listJobs(200)
  res.json({ ok: true, jobs })
})

export const ingestionComponents = asyncHandler(async (_req, res) => {
  const components = await listComponents(200)
  res.json({ ok: true, components })
})

export const ingestionComponentById = asyncHandler(async (req, res) => {
  const component = await getComponentById(req.params.id)
  if (!component) return res.status(404).json({ ok: false, error: { message: 'Not found' } })
  res.json({ ok: true, component })
})

export const ingestionScan = asyncHandler(async (req, res) => {
  const job = await createJob('scan', { trigger: 'manual' })
  try {
    const summary = await runDiscoveryScan()
    await completeJob(String(job._id), summary)
    res.json({ ok: true, summary, jobId: String(job._id) })
  } catch (err) {
    await failJob(String(job._id), serializeError(err))
    throw err
  }
})

export const ingestionExportRegistry = asyncHandler(async (_req, res) => {
  const job = await createJob('export_registry', {})
  try {
    const result = await exportRegistryToFile()
    await completeJob(String(job._id), result)
    res.json({ ok: true, result, jobId: String(job._id) })
  } catch (err) {
    await failJob(String(job._id), serializeError(err))
    throw err
  }
})

export const ingestionCandidates = asyncHandler(async (_req, res) => {
  const candidates = await getCandidates()
  res.json({ ok: true, candidates })
})

export const ingestionApproveCandidate = asyncHandler(async (req, res) => {
  const job = await createJob('approve_candidate', { candidateId: req.params.id })
  try {
    const result = await approveCandidate(req.params.id)
    await completeJob(String(job._id), result)
    res.json({ ok: true, ...result, jobId: String(job._id) })
  } catch (err) {
    await failJob(String(job._id), serializeError(err))
    throw err
  }
})

export const ingestionRejectCandidate = asyncHandler(async (req, res) => {
  const job = await createJob('reject_candidate', { candidateId: req.params.id })
  try {
    const result = await rejectCandidate(req.params.id, req.body?.reason)
    await completeJob(String(job._id), result)
    res.json({ ok: true, ...result, jobId: String(job._id) })
  } catch (err) {
    await failJob(String(job._id), serializeError(err))
    throw err
  }
})

export const ingestionGetSettings = asyncHandler(async (_req, res) => {
  const scanPaused = await getScanPaused()
  res.json({ ok: true, settings: { scanPaused } })
})

export const ingestionSetScanPaused = asyncHandler(async (req, res) => {
  const paused = await setScanPaused(Boolean(req.body?.paused))
  res.json({ ok: true, settings: { scanPaused: paused } })
})

function serializeError(err) {
  if (!err || typeof err !== 'object') return { message: String(err) }
  return { message: err.message ?? 'Error', name: err.name, stack: err.stack }
}
