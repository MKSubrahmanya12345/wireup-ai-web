import mongoose from 'mongoose'

const ingestionJobSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    input: { type: mongoose.Schema.Types.Mixed, default: {} },
    output: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
)

export const IngestionJobModel =
  mongoose.models.IngestionJob ||
  mongoose.model('IngestionJob', ingestionJobSchema, 'ingestion_jobs')

