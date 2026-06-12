import mongoose from 'mongoose'

const registrySnapshotSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    generatedAt: { type: Date, required: true, default: () => new Date() },
    checksumSha256: { type: String, required: true },
    entryCount: { type: Number, required: true },
    registry: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: false },
)

registrySnapshotSchema.index({ version: 1 }, { unique: true })

export const RegistrySnapshotModel =
  mongoose.models.RegistrySnapshot ||
  mongoose.model('RegistrySnapshot', registrySnapshotSchema, 'registry_snapshots')

