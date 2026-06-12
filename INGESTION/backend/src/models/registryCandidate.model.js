import mongoose from 'mongoose'

const registryCandidateSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, index: true },
    source: { type: String, required: true, index: true },
    sourceRef: { type: String, required: true, index: true },
    partNumber: { type: String, required: true, index: true },
    draft: { type: mongoose.Schema.Types.Mixed, required: true },
    generatedEntry: { type: mongoose.Schema.Types.Mixed, default: null },
    validation: { type: mongoose.Schema.Types.Mixed, default: null },
    approvedComponentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    approvedVersion: { type: Number, default: null },
    rejectedReason: { type: String, default: '' },
  },
  { timestamps: true },
)

registryCandidateSchema.index({ source: 1, sourceRef: 1 }, { unique: true })

export const RegistryCandidateModel =
  mongoose.models.RegistryCandidate ||
  mongoose.model('RegistryCandidate', registryCandidateSchema, 'registry_candidates')

