import { env } from '../config/env.js'
import { KiCadProvider } from './providers/kicadProvider.js'
import {
  EasyEdaLcscProvider,
  SnapEdaProvider,
  UltraLibrarianProvider,
  OctopartProvider,
} from './providers/emptyProviders.js'

export function getDiscoveryProviders() {
  const kicadPaths = String(env.KICAD_LIB_PATHS ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  return [
    new KiCadProvider({ paths: kicadPaths }),
    new EasyEdaLcscProvider(),
    new SnapEdaProvider(),
    new UltraLibrarianProvider(),
    new OctopartProvider(),
  ]
}

