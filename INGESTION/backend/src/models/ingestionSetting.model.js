import mongoose from 'mongoose'

const ingestionSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
)

export const IngestionSettingModel =
  mongoose.models.IngestionSetting ||
  mongoose.model('IngestionSetting', ingestionSettingSchema, 'ingestion_settings')

