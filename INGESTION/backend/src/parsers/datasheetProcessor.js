import { fetchDatasheet } from './datasheetFetcher.js'
import { parsePdf } from './pdfParser.js'
import { parseHtml } from './htmlParser.js'

export async function processDatasheet(url) {
  const { contentType, buffer } = await fetchDatasheet(url)

  const lowerUrl = url.toLowerCase()
  const isPdf =
    contentType.toLowerCase().includes('application/pdf') ||
    lowerUrl.endsWith('.pdf') ||
    lowerUrl.includes('.pdf?')

  if (isPdf) {
    const parsed = await parsePdf(buffer)
    return {
      url,
      kind: 'pdf',
      title: inferTitle(parsed.text),
      text: parsed.text,
      tables: [],
      metadata: parsed.metadata,
    }
  }

  const html = parseHtml(buffer)
  return {
    url,
    kind: 'html',
    title: html.title,
    text: html.text,
    tables: html.tables,
    metadata: {},
  }
}

function inferTitle(text) {
  const firstLine = String(text ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)[0]
  return firstLine?.slice(0, 120) ?? ''
}

