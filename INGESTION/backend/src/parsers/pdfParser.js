import pdfParse from 'pdf-parse'

export async function parsePdf(buffer) {
  const parsed = await pdfParse(buffer)
  return {
    kind: 'pdf',
    text: parsed.text ?? '',
    metadata: {
      info: parsed.info ?? null,
      numpages: parsed.numpages ?? null,
    },
  }
}

