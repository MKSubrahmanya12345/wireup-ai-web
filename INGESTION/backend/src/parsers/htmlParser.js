import * as cheerio from 'cheerio'

export function parseHtml(buffer) {
  const html = buffer.toString('utf8')
  const $ = cheerio.load(html)

  $('script').remove()
  $('style').remove()

  const title = $('title').first().text().trim()
  const text = $('body').text().replace(/\s+/g, ' ').trim()

  const tables = []
  $('table').each((_, table) => {
    const rows = []
    $(table)
      .find('tr')
      .each((__, tr) => {
        const cols = []
        $(tr)
          .find('th,td')
          .each((___, td) => {
            cols.push($(td).text().replace(/\s+/g, ' ').trim())
          })
        if (cols.length) rows.push(cols)
      })
    if (rows.length) tables.push(rows)
  })

  return {
    kind: 'html',
    title,
    text,
    tables,
  }
}

