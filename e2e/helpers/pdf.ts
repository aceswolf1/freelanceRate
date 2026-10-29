/**
 * A minimal PDF text extractor for the E2E suite.
 *
 * The invoice PDF is produced by pdfmake/pdfkit with the standard-14 Helvetica
 * face (no embedded font), so the text operators in the content stream are
 * plain ASCII — the stream itself is Flate-compressed. This helper inflates
 * every stream and collects the literal strings of the text-showing
 * operators (`Tj` / `TJ`), which is enough to assert on the rendered text.
 *
 * It is deliberately dependency-free: the suite must not need a PDF library.
 */
import { inflateSync } from 'node:zlib'

/** Inflates every stream of the document and returns the concatenated content. */
function inflateStreams(bytes: Buffer): string {
  const STREAM = Buffer.from('stream')
  const ENDSTREAM = Buffer.from('endstream')
  const chunks: string[] = []
  let index = 0

  for (;;) {
    const start = bytes.indexOf(STREAM, index)
    if (start === -1) {
      break
    }
    let dataStart = start + STREAM.length
    if (bytes[dataStart] === 0x0d) {
      dataStart += 1
    }
    if (bytes[dataStart] === 0x0a) {
      dataStart += 1
    }
    const end = bytes.indexOf(ENDSTREAM, dataStart)
    if (end === -1) {
      break
    }
    const raw = bytes.subarray(dataStart, end)
    index = end + ENDSTREAM.length

    try {
      chunks.push(inflateSync(raw).toString('latin1'))
    }
    catch {
      // Not a Flate stream (or an empty one) — keep the raw bytes.
      chunks.push(raw.toString('latin1'))
    }
  }

  return chunks.join('\n')
}

/** The literal strings of the text-showing operators, in document order. */
function literalStrings(content: string): string[] {
  const values: string[] = []
  // pdfkit writes its text as hex strings (`<416c65>` → "Ale"); other producers
  // use literal strings (`(Attn: Jane Doe)`). Both are collected, in order.
  const pattern = /<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\()])*)\)/g
  let match = pattern.exec(content)
  while (match !== null) {
    if (match[1] !== undefined) {
      const hex = match[1].replace(/\s+/g, '')
      if (hex.length > 0 && hex.length % 2 === 0) {
        values.push(Buffer.from(hex, 'hex').toString('latin1'))
      }
    }
    else if (match[2] !== undefined) {
      values.push(match[2].replace(/\\([()\\])/g, '$1'))
    }
    match = pattern.exec(content)
  }
  return values
}

/**
 * The visible text of a PDF document.
 *
 * Strings are joined with a newline so that two adjacent words never merge
 * into one token; use {@link squash} when the comparison should ignore
 * whitespace altogether.
 */
export function pdfText(bytes: Buffer): string {
  return literalStrings(inflateStreams(bytes)).join('\n')
}

/** Removes every whitespace character — for whitespace-insensitive comparisons. */
export function squash(text: string): string {
  return text.replace(/\s+/g, '')
}
