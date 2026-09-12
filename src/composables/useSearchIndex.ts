import { ref, shallowRef } from 'vue'
import type { DocumentEntry } from '../../shared/types'
import { api } from '../lib/api'
import { indexDocument, type IndexedDocument } from '../lib/search'

type CacheEntry = { modifiedAt: string; indexed: Promise<IndexedDocument> }

const cache = new Map<string, CacheEntry>()
const indexed = shallowRef<IndexedDocument[]>([])
const indexing = ref(false)
let running = 0

// 読み込み中の約束を先に置く。同じ資料を同時に頼まれても1回しか読まない
function indexOne(document: DocumentEntry, parser: DOMParser): Promise<IndexedDocument> {
  const cached = cache.get(document.path)
  if (cached !== undefined && cached.modifiedAt === document.modifiedAt) return cached.indexed
  const work = (async () => {
    const html = await api.documentHtml(document.path)
    return indexDocument(document.path, document.name, parser.parseFromString(html, 'text/html'))
  })().catch((error: unknown) => {
    // 失敗したら覚えない（次に開いたときやり直せるように）
    cache.delete(document.path)
    throw error
  })
  cache.set(document.path, { modifiedAt: document.modifiedAt, indexed: work })
  return work
}

// 教材の本文を読み込んで検索用に整える。更新日時が変わった資料だけ読み直す
async function ensureIndex(documents: readonly DocumentEntry[]): Promise<IndexedDocument[]> {
  running++
  indexing.value = true
  try {
    const parser = new DOMParser()
    const done: IndexedDocument[] = []
    await Promise.all(
      documents.map(async (document) => {
        const one = await indexOne(document, parser)
        done.push(one)
        // 1冊できるたびに検索できるようにする
        indexed.value = [...indexed.value.filter((entry) => entry.path !== one.path), one]
      }),
    )
    // 資料フォルダから消えたものは落とす
    indexed.value = done
    return done
  } finally {
    running--
    if (running === 0) indexing.value = false
  }
}

export function clearSearchIndex(): void {
  cache.clear()
  indexed.value = []
  indexing.value = false
  running = 0
}

export function useSearchIndex() {
  return { indexed, indexing, ensureIndex }
}
