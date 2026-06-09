import { http } from './http.js'

export async function ingestionSearch(payload) {
  const res = await http.post('/api/ingestion/search', payload)
  return res.data
}

export async function ingestionGenerateRegistry(payload) {
  const res = await http.post('/api/ingestion/generate-registry', payload)
  return res.data
}

export async function ingestionValidate(payload) {
  const res = await http.post('/api/ingestion/validate', payload)
  return res.data
}

export async function ingestionImport(payload) {
  const res = await http.post('/api/ingestion/import', payload)
  return res.data
}

export async function ingestionJobs() {
  const res = await http.get('/api/ingestion/jobs')
  return res.data
}

export async function ingestionComponents() {
  const res = await http.get('/api/ingestion/components')
  return res.data
}

export async function ingestionComponentById(id) {
  const res = await http.get(`/api/ingestion/components/${encodeURIComponent(id)}`)
  return res.data
}

export async function ingestionScan() {
  const res = await http.post('/api/ingestion/scan', {})
  return res.data
}

export async function ingestionExportRegistry() {
  const res = await http.post('/api/ingestion/export-registry', {})
  return res.data
}

export async function ingestionCandidates() {
  const res = await http.get('/api/ingestion/candidates')
  return res.data
}

export async function ingestionApproveCandidate(id) {
  const res = await http.post(`/api/ingestion/candidates/${encodeURIComponent(id)}/approve`, {})
  return res.data
}

export async function ingestionRejectCandidate(id, reason) {
  const res = await http.post(`/api/ingestion/candidates/${encodeURIComponent(id)}/reject`, { reason })
  return res.data
}

export async function ingestionGetSettings() {
  const res = await http.get('/api/ingestion/settings')
  return res.data
}

export async function ingestionSetScanPaused(paused) {
  const res = await http.post('/api/ingestion/settings/scan-paused', { paused })
  return res.data
}
