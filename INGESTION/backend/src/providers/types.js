export class ComponentSearchProvider {
  constructor(name) {
    this.name = name
  }
  async search(_) {
    throw new Error('Not implemented')
  }
}

