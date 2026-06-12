import { ManualProvider } from './manualProvider.js'

const providers = [new ManualProvider()]

export function getProvider(name) {
  const providerName = (name ?? 'manual').toLowerCase()
  const found = providers.find((p) => p.name.toLowerCase() === providerName)
  return found ?? providers[0]
}

