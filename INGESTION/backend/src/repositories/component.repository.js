import { ComponentModel } from '../models/component.model.js'

export async function listComponents(limit = 100) {
  return ComponentModel.find({}).sort({ updatedAt: -1 }).limit(limit).lean()
}

export async function listAllComponents() {
  return ComponentModel.find({}).sort({ updatedAt: 1 }).lean()
}

export async function getComponentById(id) {
  return ComponentModel.findById(id).lean()
}

export async function findComponentByKey(partNumber, manufacturer) {
  return ComponentModel.findOne({ partNumber, manufacturer: manufacturer ?? '' })
}

export async function upsertComponentByKey(input) {
  return ComponentModel.findOneAndUpdate(
    { partNumber: input.partNumber, manufacturer: input.manufacturer },
    { $set: input },
    { upsert: true, new: true },
  )
}
