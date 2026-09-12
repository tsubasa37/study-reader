import { computed, type Ref } from 'vue'
import { locateQuote } from '../lib/anchoring'
import type { IndexedDocument } from '../lib/search'
import { matchesText } from '../lib/search'
import { toNotes } from '../lib/notes'
import type { NoteGroup, NoteListEntry } from '../types/ui'
import { useStudyStore } from './useStudyStore'

export type NoteFilter = {
  kind: 'all' | 'bookmark' | 'highlight'
  path: string
  text: string
}

// 全資料のしおりとハイライトを資料ごとにまとめ、見失ったハイライトに印を付ける
export function useNoteGroups(filter: Ref<NoteFilter>, indexed: Ref<IndexedDocument[]>) {
  const store = useStudyStore()

  const entries = computed<NoteListEntry[]>(() => {
    const texts = new Map(indexed.value.map((document) => [document.path, document.text]))
    const quoteOf = new Map(store.state.highlights.map((item) => [item.id, item]))
    return toNotes(store.state.bookmarks, store.state.highlights).map((note) => {
      const highlight = note.kind === 'highlight' ? quoteOf.get(note.id) : undefined
      const text = highlight === undefined ? undefined : texts.get(highlight.path)
      // 本文を読み込めている資料だけ、ハイライトが見つかるかを見る
      return { ...note, lost: highlight !== undefined && text !== undefined && locateQuote(text, highlight.quote) === null }
    })
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
    const byPath = new Map<string, NoteListEntry[]>()
    for (const entry of visible) byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry])
    return [...byPath.entries()]
      .map(([groupPath, groupEntries]) => ({
        path: groupPath,
        name: store.documentsByPath.value.get(groupPath)?.name ?? groupPath,
        entries: groupEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }))
      .sort((a, b) => (order.get(a.path) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.path) ?? Number.MAX_SAFE_INTEGER))
  })

  const total = computed(() => groups.value.reduce((sum, group) => sum + group.entries.length, 0))

  return { groups, total }
}
