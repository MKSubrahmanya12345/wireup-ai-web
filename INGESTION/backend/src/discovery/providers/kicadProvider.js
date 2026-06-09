import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DiscoveryProvider } from './base.js'
import { extractSymbolsFromKicadSym } from '../kicad/kicadSymbolExtractor.js'

export class KiCadProvider extends DiscoveryProvider {
  constructor(options) {
    super('kicad')
    this.paths = options.paths ?? []
  }

  async discover() {
    const files = []
    for (const p of this.paths) {
      if (!p) continue
      const abs = path.resolve(p)
      await collectFiles(abs, files)
    }

    const out = []
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.kicad_sym')) continue
      const text = await fs.readFile(file, 'utf8')
      const symbols = extractSymbolsFromKicadSym(text, file)
      out.push(...symbols)
    }
    return out
  }
}

async function collectFiles(dir, out) {
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      await collectFiles(full, out)
      continue
    }
    if (ent.isFile()) out.push(full)
  }
}

