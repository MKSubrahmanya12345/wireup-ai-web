import { getCandidateById, listCandidates, markCandidateApproved, markCandidateRejected } from '../repositories/registryCandidate.repository.js'
import { importComponent } from './ingestionService.js'
import { HttpError } from '../utils/httpError.js'

export async function getCandidates() {
  return listCandidates(200)
}

export async function approveCandidate(candidateId) {
  const cand = await getCandidateById(candidateId)
  if (!cand) throw new HttpError(404, 'Candidate not found')
  if (cand.status === 'approved') return { ok: true, candidate: cand }
  if (cand.status === 'rejected') throw new HttpError(400, 'Candidate is rejected')

  const draft = cand.draft
  const imported = await importComponent(draft)
  if (!imported.ok) throw new HttpError(400, 'Import failed', imported.validation)

  const updated = await markCandidateApproved(candidateId, imported.componentId, imported.version)
  return { ok: true, candidate: updated, import: imported }
}

export async function rejectCandidate(candidateId, reason) {
  const cand = await getCandidateById(candidateId)
  if (!cand) throw new HttpError(404, 'Candidate not found')
  const updated = await markCandidateRejected(candidateId, reason ?? '')
  return { ok: true, candidate: updated }
}

