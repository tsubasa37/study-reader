import type { TextQuote } from '../../shared/types'
import { quoteFromIndexes } from './anchoring'
import { detectSections } from './sections'
import { buildTextMap, elementSpan, normalizeSpace } from './textMap'

export type IndexedSection = { id: string; title: string; start: number; end: number }

export type IndexedDocument = {
  path: string
  name: string
  text: string
  folded: string
  sections: IndexedSection[]
}

export type SearchHit = {
  path: string
  name: string
  sectionId: string | null
  sectionTitle: string | null
  quote: TextQuote
  before: string
  match: string
  after: string
}

const SNIPPET_BEFORE = 36
const SNIPPET_AFTER = 64

// 全角英数と半角、大文字と小文字を同じに扱う。1文字が2文字以上に変わる場合は元のまま（位置をずらさないため）
export function foldForSearch(text: string): string {
  let folded = ''
  for (const char of text) {
    const converted = char.normalize('NFKC').toLowerCase()
    folded += converted.length === char.length ? converted : char
  }
  return folded
}

export function matchesText(fields: readonly string[], query: string): boolean {
  const needle = foldForSearch(normalizeSpace(query))
  if (needle === '') return false
  return fields.some((field) => foldForSearch(normalizeSpace(field)).includes(needle))
}

export function indexDocument(path: string, name: string, doc: Document): IndexedDocument {
  const map = buildTextMap(doc.body)
  const sections: IndexedSection[] = []
  for (const section of detectSections(doc)) {
    const span = elementSpan(map, section.element)
    if (span !== null) sections.push({ id: section.id, title: section.title, ...span })
  }
  return { path, name, text: map.text, folded: foldForSearch(map.text), sections }
}

function sectionAt(sections: readonly IndexedSection[], index: number): IndexedSection | null {
  let found: IndexedSection | null = null
  for (const section of sections) {
    if (section.start <= index && index < section.end) found = section
  }
  return found
}

export function searchDocuments(documents: readonly IndexedDocument[], query: string, limitPerDocument = 30): SearchHit[] {
  const needle = foldForSearch(normalizeSpace(query))
  if (needle === '') return []
  const hits: SearchHit[] = []
  for (const document of documents) {
    let count = 0
    for (let index = document.folded.indexOf(needle); index !== -1 && count < limitPerDocument; index = document.folded.indexOf(needle, index + needle.length)) {
      const end = index + needle.length
      const quote = quoteFromIndexes(document.text, index, end)
      if (quote === null) continue
      const section = sectionAt(document.sections, index)
      hits.push({
        path: document.path,
        name: document.name,
        sectionId: section?.id ?? null,
        sectionTitle: section?.title ?? null,
        quote,
        before: document.text.slice(Math.max(0, index - SNIPPET_BEFORE), index),
        match: document.text.slice(index, end),
        after: document.text.slice(end, end + SNIPPET_AFTER),
      })
      count++
    }
  }
  return hits
}
