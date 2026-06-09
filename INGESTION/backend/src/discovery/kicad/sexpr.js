export function parseSexpr(text) {
  const tokens = tokenize(text)
  const root = []
  const stack = [root]

  for (const tok of tokens) {
    if (tok.type === 'lpar') {
      const arr = []
      stack[stack.length - 1].push(arr)
      stack.push(arr)
      continue
    }
    if (tok.type === 'rpar') {
      if (stack.length === 1) throw new Error('Unexpected )')
      stack.pop()
      continue
    }
    stack[stack.length - 1].push(tok.value)
  }

  if (stack.length !== 1) throw new Error('Unclosed (')
  return root
}

function tokenize(text) {
  const tokens = []
  let i = 0

  while (i < text.length) {
    const c = text[i]
    if (c === ';') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '(') {
      tokens.push({ type: 'lpar' })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ type: 'rpar' })
      i++
      continue
    }
    if (isWs(c)) {
      i++
      continue
    }
    if (c === '"') {
      const { value, next } = readString(text, i)
      tokens.push({ type: 'atom', value })
      i = next
      continue
    }
    const { value, next } = readAtom(text, i)
    tokens.push({ type: 'atom', value })
    i = next
  }

  return tokens
}

function readString(text, start) {
  let i = start + 1
  let out = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '"') return { value: out, next: i + 1 }
    if (c === '\\') {
      const n = text[i + 1]
      if (n === '"' || n === '\\') {
        out += n
        i += 2
        continue
      }
    }
    out += c
    i++
  }
  throw new Error('Unterminated string')
}

function readAtom(text, start) {
  let i = start
  let out = ''
  while (i < text.length) {
    const c = text[i]
    if (c === '(' || c === ')' || isWs(c) || c === ';') break
    out += c
    i++
  }
  return { value: out, next: i }
}

function isWs(c) {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n'
}

