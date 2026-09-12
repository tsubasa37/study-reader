import type { Bookmark, Highlight } from '../../shared/types'
import type { NoteEntry } from '../types/ui'

// しおりとハイライトを、一覧や検索結果で同じ形に扱うための変換
export function bookmarkToNote(item: Bookmark): NoteEntry {
  return {
    kind: 'bookmark',
    id: item.id,
    path: item.path,
    sectionTitle: item.sectionTitle,
    text: item.excerpt,
    memo: item.memo,
    color: null,
    createdAt: item.createdAt,
  }
}

export function highlightToNote(item: Highlight): NoteEntry {
  return {
    kind: 'highlight',
    id: item.id,
    path: item.path,
    sectionTitle: item.sectionTitle,
    text: item.quote.exact,
    memo: item.memo,
    color: item.color,
    createdAt: item.createdAt,
  }
}

// ハイライトを先に並べる（本文に色が付いている方が思い出しやすいため）
export function toNotes(bookmarks: readonly Bookmark[], highlights: readonly Highlight[]): NoteEntry[] {
  return [...highlights.map(highlightToNote), ...bookmarks.map(bookmarkToNote)]
}
