import { IngestionJobModel } from '../models/ingestionJob.model.js'

export async function createJob(type, input) {
  return IngestionJobModel.create({ type, status: 'running', input })
}

export async function completeJob(jobId, output) {
  return IngestionJobModel.findByIdAndUpdate(jobId, { status: 'success', output }, { new: true })
}

export async function failJob(jobId, error) {
  return IngestionJobModel.findByIdAndUpdate(jobId, { status: 'error', error }, { new: true })
}

export async function listJobs(limit = 100) {
  return IngestionJobModel.find({}).sort({ createdAt: -1 }).limit(limit).lean()
}

