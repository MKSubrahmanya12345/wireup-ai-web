import { HttpError } from '../utils/httpError.js'

export async function fetchDatasheet(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new HttpError(400, `Failed to fetch datasheet (${res.status})`)

  const contentType = res.headers.get('content-type') ?? ''
  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return { contentType, buffer }
}

