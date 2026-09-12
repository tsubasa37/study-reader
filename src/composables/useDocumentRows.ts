import { computed, type ComputedRef, type Ref } from 'vue'
import type { DocumentEntry, DocumentProgress } from '../../shared/types'
import { useStudyStore } from './useStudyStore'

export type DocumentRowData = {
  document: DocumentEntry
  progress: DocumentProgress | null
  bookmarks: number
  highlights: number
}

export function useDocumentRows(documents: Ref<readonly DocumentEntry[]>): ComputedRef<DocumentRowData[]> {
  const store = useStudyStore()
  return computed(() =>
    documents.value.map((document) => ({
      document,
      progress: store.state.progress[document.path] ?? null,
      bookmarks: store.state.bookmarks.filter((item) => item.path === document.path).length,
      highlights: store.state.highlights.filter((item) => item.path === document.path).length,
    })),
  )
}
