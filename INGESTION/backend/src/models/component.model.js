import mongoose from 'mongoose'

const pinSchema = new mongoose.Schema(
  {
    number: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String, default: '' },
    busCapabilities: { type: [String], default: [] },
  },
  { _id: false },
)

const componentSchema = new mongoose.Schema(
  {
    partNumber: { type: String, required: true, index: true },
    manufacturer: { type: String, default: '' },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    family: { type: String, default: '' },
    category: { type: String, default: '' },
    datasheetUrl: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    wokwiType: { type: String, default: '' },
    pins: { type: [pinSchema], default: [] },
    configDefaults: { type: mongoose.Schema.Types.Mixed, default: {} },
    runtimeDefaults: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

componentSchema.index({ partNumber: 1, manufacturer: 1 }, { unique: true })

export const ComponentModel =
  mongoose.models.Component || mongoose.model('Component', componentSchema, 'components')

