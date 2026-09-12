import type { useStudyStore } from '../../composables/useStudyStore'
import { matchesText } from '../../lib/search'
import type { NoteHit } from '../../types/ui'

const NOTE_LIMIT = 20

export function findNoteHits(store: ReturnType<typeof useStudyStore>, query: string): NoteHit[] {
  if (query.trim() === '') return []
  const nameOf = (path: string) => store.documentsByPath.value.get(path)?.name ?? path
  const highlights: NoteHit[] = store.state.highlights
    .filter((item) => matchesText([item.quote.exact, item.memo], query))
    .map((item) => ({
      kind: 'highlight',
      id: item.id,
      path: item.path,
      name: nameOf(item.path),
      sectionTitle: item.sectionTitle,
      text: item.quote.exact,
      memo: item.memo,
      color: item.color,
    }))
  const bookmarks: NoteHit[] = store.state.bookmarks
    .filter((item) => matchesText([item.excerpt, item.memo, item.sectionTitle ?? ''], query))
    .map((item) => ({
      kind: 'bookmark',
      id: item.id,
      path: item.path,
      name: nameOf(item.path),
      sectionTitle: item.sectionTitle,
      text: item.excerpt,
      memo: item.memo,
    }))
  return [...highlights, ...bookmarks]
    .filter((hit) => store.documentsByPath.value.has(hit.path))
    .slice(0, NOTE_LIMIT)
}
