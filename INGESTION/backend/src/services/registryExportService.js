import { promises as fs } from 'node:fs'
import path from 'node:path'
import { env } from '../config/env.js'
import { generateRegistrySnapshot } from './registrySnapshotService.js'

export async function exportRegistryToFile(outputPath) {
  const snapshot = await generateRegistrySnapshot()
  const target = outputPath || env.REGISTRY_OUTPUT_PATH

  const resolved = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target)
  const dir = path.dirname(resolved)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(resolved, JSON.stringify(snapshot.registry, null, 2), 'utf8')

  return { path: resolved, version: snapshot.version, checksumSha256: snapshot.checksumSha256, entryCount: snapshot.entryCount }
}

