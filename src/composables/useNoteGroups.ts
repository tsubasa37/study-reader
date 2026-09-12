import { computed, type Ref } from 'vue'
import { locateQuote } from '../lib/anchoring'
import type { IndexedDocument } from '../lib/search'
import { matchesText } from '../lib/search'
import type { NoteEntry, NoteGroup } from '../types/ui'
import { useStudyStore } from './useStudyStore'

export type NoteFilter = {
  kind: 'all' | 'bookmark' | 'highlight'
  path: string
  text: string
}

// 全資料のしおりとハイライトを資料ごとにまとめ、見失ったハイライトに印を付ける
export function useNoteGroups(filter: Ref<NoteFilter>, indexed: Ref<IndexedDocument[]>) {
  const store = useStudyStore()

  const entries = computed<NoteEntry[]>(() => {
    const texts = new Map(indexed.value.map((document) => [document.path, document.text]))
    const bookmarks: NoteEntry[] = store.state.bookmarks.map((item) => ({
      kind: 'bookmark',
      id: item.id,
      path: item.path,
      sectionTitle: item.sectionTitle,
      text: item.excerpt,
      memo: item.memo,
      color: null,
      createdAt: item.createdAt,
      lost: false,
    }))
    const highlights: NoteEntry[] = store.state.highlights.map((item) => {
      const text = texts.get(item.path)
      return {
        kind: 'highlight',
        id: item.id,
        path: item.path,
        sectionTitle: item.sectionTitle,
        text: item.quote.exact,
        memo: item.memo,
        color: item.color,
        createdAt: item.createdAt,
        lost: text !== undefined && locateQuote(text, item.quote) === null,
      }
    })
    return [...highlights, ...bookmarks]
  })

  const groups = computed<NoteGroup[]>(() => {
    const { kind, path, text } = filter.value
    const visible = entries.value.filter(
      (entry) =>
        (kind === 'all' || entry.kind === kind) &&
        (path === '' || entry.path === path) &&
        (text.trim() === '' || matchesText([entry.text, entry.memo, entry.sectionTitle ?? ''], text)),
    )
    const order = new Map(store.state.documents.map((document, index) => [document.path, index]))
    const byPath = new Map<string, NoteEntry[]>()
    for (const entry of visible) byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry])
    return [...byPath.entries()]
      .map(([groupPath, groupEntries]) => ({
        path: groupPath,
        name: store.documentsByPath.value.get(groupPath)?.name ?? groupPath,
        missing: !store.documentsByPath.value.has(groupPath),
        entries: groupEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => (order.get(a.path) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.path) ?? Number.MAX_SAFE_INTEGER))
  })

  const total = computed(() => groups.value.reduce((sum, group) => sum + group.entries.length, 0))

  return { groups, total }
}
