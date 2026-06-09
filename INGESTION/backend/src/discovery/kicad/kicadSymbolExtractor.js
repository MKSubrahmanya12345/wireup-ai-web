import { parseSexpr } from './sexpr.js'

export function extractSymbolsFromKicadSym(text, sourceRef) {
  const ast = parseSexpr(text)
  const symbols = []

  walk(ast, (node) => {
    if (!Array.isArray(node)) return
    if (node[0] !== 'symbol') return
    const name = String(node[1] ?? '').trim()
    if (!name) return

    const properties = extractProperties(node)
    const pins = extractPins(node)

    symbols.push({
      source: 'kicad',
      sourceRef: `${sourceRef}::${name}`,
      partNumber: name,
      name,
      description: properties.Description ?? '',
      datasheetUrl: properties.Datasheet ?? '',
      footprint: properties.Footprint ?? '',
      pins,
      raw: { properties },
    })
  })

  return symbols
}

function extractProperties(symbolNode) {
  const props = {}
  for (const child of symbolNode) {
    if (!Array.isArray(child)) continue
    if (child[0] !== 'property') continue
    const key = String(child[1] ?? '').trim()
    const val = String(child[2] ?? '').trim()
    if (key) props[key] = val
  }
  return props
}

function extractPins(symbolNode) {
  const pins = []
  walk(symbolNode, (node) => {
    if (!Array.isArray(node)) return
    if (node[0] !== 'pin') return
    const number = findPropValue(node, 'number')
    const name = findPropValue(node, 'name')
    if (!number || !name) return
    pins.push({ number, name })
  })
  return pins
}

function findPropValue(pinNode, key) {
  for (const child of pinNode) {
    if (!Array.isArray(child)) continue
    if (child[0] !== key) continue
    return String(child[1] ?? '').trim()
  }
  return ''
}

function walk(node, fn) {
  fn(node)
  if (Array.isArray(node)) {
    for (const child of node) walk(child, fn)
  }
}

