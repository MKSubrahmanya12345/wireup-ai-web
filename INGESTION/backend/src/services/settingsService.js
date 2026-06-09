import { getSetting, setSetting } from '../repositories/ingestionSetting.repository.js'

const SCAN_PAUSED_KEY = 'scanPaused'

export async function getScanPaused() {
  const doc = await getSetting(SCAN_PAUSED_KEY)
  return Boolean(doc?.value ?? false)
}

export async function setScanPaused(paused) {
  const doc = await setSetting(SCAN_PAUSED_KEY, Boolean(paused))
  return Boolean(doc.value)
}

