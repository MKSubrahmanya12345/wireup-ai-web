import mongoose from 'mongoose'

const componentVersionSchema = new mongoose.Schema(
  {
    componentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, required: true },
    registryEntry: { type: mongoose.Schema.Types.Mixed, required: true },
    checksumSha256: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
)

componentVersionSchema.index({ componentId: 1, version: 1 }, { unique: true })

export const ComponentVersionModel =
  mongoose.models.ComponentVersion ||
  mongoose.model('ComponentVersion', componentVersionSchema, 'component_versions')

