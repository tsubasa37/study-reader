import type { useStudyStore } from '../../composables/useStudyStore'
import { toNotes } from '../../lib/notes'
import { matchesText } from '../../lib/search'
import type { NoteHit } from '../../types/ui'

const NOTE_LIMIT = 20

// しおりとハイライトを、メモや本文の文字で探す
export function findNoteHits(store: ReturnType<typeof useStudyStore>, query: string): NoteHit[] {
  if (query.trim() === '') return []
  return toNotes(store.state.bookmarks, store.state.highlights)
    .filter((note) => matchesText([note.text, note.memo, note.sectionTitle ?? ''], query))
    .filter((note) => store.documentsByPath.value.has(note.path))
    .map((note) => ({ ...note, name: store.documentsByPath.value.get(note.path)?.name ?? note.path }))
    .slice(0, NOTE_LIMIT)
}
