import { IngestionSettingModel } from '../models/ingestionSetting.model.js'

export async function getSetting(key) {
  return IngestionSettingModel.findOne({ key }).lean()
}

export async function setSetting(key, value) {
  return IngestionSettingModel.findOneAndUpdate(
    { key },
    { $set: { key, value } },
    { upsert: true, new: true },
  ).lean()
}

