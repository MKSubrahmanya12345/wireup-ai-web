import { RegistrySnapshotModel } from '../models/registrySnapshot.model.js'

export async function getLatestSnapshot() {
  return RegistrySnapshotModel.findOne({}).sort({ version: -1 }).lean()
}

export async function createSnapshot(input) {
  return RegistrySnapshotModel.create(input)
}

