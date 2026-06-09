import mongoose from 'mongoose'
import { ComponentVersionModel } from '../models/componentVersion.model.js'

export async function getLatestComponentVersion(componentId) {
  return ComponentVersionModel.findOne({ componentId }).sort({ version: -1 }).lean()
}

export async function createComponentVersion(input) {
  return ComponentVersionModel.create(input)
}

export async function getLatestVersionsByComponentIds(componentIds) {
  const ids = componentIds.map((id) => new mongoose.Types.ObjectId(id))
  const rows = await ComponentVersionModel.aggregate([
    { $match: { componentId: { $in: ids } } },
    { $sort: { version: -1 } },
    { $group: { _id: '$componentId', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
  ])
  const byId = new Map()
  for (const row of rows) byId.set(String(row.componentId), row)
  return byId
}
