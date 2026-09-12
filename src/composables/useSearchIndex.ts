import { ref, shallowRef } from 'vue'
import type { DocumentEntry } from '../../shared/types'
import { api } from '../lib/api'
import { indexDocument, type IndexedDocument } from '../lib/search'

const cache = new Map<string, { modifiedAt: string; indexed: IndexedDocument }>()
const indexed = shallowRef<IndexedDocument[]>([])
const indexing = ref(false)

async function indexOne(document: DocumentEntry, parser: DOMParser): Promise<IndexedDocument> {
  const cached = cache.get(document.path)
  if (cached !== undefined && cached.modifiedAt === document.modifiedAt) return cached.indexed
  const html = await api.documentHtml(document.path)
  const result = indexDocument(document.path, document.name, parser.parseFromString(html, 'text/html'))
  cache.set(document.path, { modifiedAt: document.modifiedAt, indexed: result })
  return result
}

// 教材の本文を読み込んで検索用に整える。更新日時が変わった資料だけ読み直す
async function ensureIndex(documents: readonly DocumentEntry[]): Promise<IndexedDocument[]> {
  indexing.value = true
  try {
    const parser = new DOMParser()
    indexed.value = await Promise.all(documents.map((document) => indexOne(document, parser)))
    return indexed.value
  } finally {
    indexing.value = false
  }
}

export function useSearchIndex() {
  return { indexed, indexing, ensureIndex }
}
