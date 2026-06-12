import { DiscoveryProvider } from './base.js'

export class EasyEdaLcscProvider extends DiscoveryProvider {
  constructor() {
    super('easyeda_lcsc')
  }
  async discover() {
    return []
  }
}

export class SnapEdaProvider extends DiscoveryProvider {
  constructor() {
    super('snapeda')
  }
  async discover() {
    return []
  }
}

export class UltraLibrarianProvider extends DiscoveryProvider {
  constructor() {
    super('ultralibrarian')
  }
  async discover() {
    return []
  }
}

export class OctopartProvider extends DiscoveryProvider {
  constructor() {
    super('octopart')
  }
  async discover() {
    return []
  }
}

