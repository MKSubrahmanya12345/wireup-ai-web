import { RegistryCandidateModel } from '../models/registryCandidate.model.js'

export async function upsertCandidate(input) {
  return RegistryCandidateModel.findOneAndUpdate(
    { source: input.source, sourceRef: input.sourceRef },
    { $set: input },
    { upsert: true, new: true },
  )
}

export async function listCandidates(limit = 200) {
  return RegistryCandidateModel.find({}).sort({ updatedAt: -1 }).limit(limit).lean()
}

export async function getCandidateById(id) {
  return RegistryCandidateModel.findById(id)
}

export async function markCandidateApproved(id, componentId, version) {
  return RegistryCandidateModel.findByIdAndUpdate(
    id,
    { status: 'approved', approvedComponentId: componentId, approvedVersion: version },
    { new: true },
  )
}

export async function markCandidateRejected(id, reason) {
  return RegistryCandidateModel.findByIdAndUpdate(
    id,
    { status: 'rejected', rejectedReason: reason ?? '' },
    { new: true },
  )
}

