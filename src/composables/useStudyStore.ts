import { computed, reactive } from 'vue'
import type {
  Bookmark,
  BookmarkPatch,
  DocumentEntry,
  DocumentProgress,
  Highlight,
  HighlightPatch,
  NewBookmark,
  NewHighlight,
  RecordsMove,
  RecordsSummary,
} from '../../shared/types'
import { api } from '../lib/api'
import type { OrphanRecord } from '../types/ui'

type StoreState = {
  loaded: boolean
  vaultName: string
  documents: DocumentEntry[]
  progress: Record<string, DocumentProgress>
  bookmarks: Bookmark[]
  highlights: Highlight[]
}

const state = reactive<StoreState>({
  loaded: false,
  vaultName: '',
  documents: [],
  progress: {},
  bookmarks: [],
  highlights: [],
})

let loading: Promise<void> | null = null

async function fetchAll(): Promise<void> {
  const [list, study] = await Promise.all([api.documents(), api.state()])
  state.vaultName = list.vaultName
  state.documents = list.documents
  state.progress = study.progress
  state.bookmarks = study.bookmarks
  state.highlights = study.highlights
  state.loaded = true
}

export function loadStudyState(): Promise<void> {
  loading ??= fetchAll().catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

async function refreshDocuments(): Promise<void> {
  const list = await api.documents()
  state.vaultName = list.vaultName
  state.documents = list.documents
}

async function saveProgress(entry: DocumentProgress, keepalive = false): Promise<void> {
  state.progress = { ...state.progress, [entry.path]: entry }
  await api.saveProgress(entry, keepalive)
}

async function addBookmark(input: NewBookmark): Promise<Bookmark> {
  const created = await api.addBookmark(input)
  state.bookmarks = [...state.bookmarks, created]
  return created
}

async function updateBookmark(id: string, patch: BookmarkPatch): Promise<void> {
  const updated = await api.updateBookmark(id, patch)
  state.bookmarks = state.bookmarks.map((item) => (item.id === id ? updated : item))
}

async function deleteBookmark(id: string): Promise<void> {
  await api.deleteBookmark(id)
  state.bookmarks = state.bookmarks.filter((item) => item.id !== id)
}

async function addHighlight(input: NewHighlight): Promise<Highlight> {
  const created = await api.addHighlight(input)
  state.highlights = [...state.highlights, created]
  return created
}

async function updateHighlight(id: string, patch: HighlightPatch): Promise<void> {
  const updated = await api.updateHighlight(id, patch)
  state.highlights = state.highlights.map((item) => (item.id === id ? updated : item))
}

async function deleteHighlight(id: string): Promise<void> {
  await api.deleteHighlight(id)
  state.highlights = state.highlights.filter((item) => item.id !== id)
}

async function reloadAll(): Promise<void> {
  loading = null
  await loadStudyState()
}

async function moveRecords(move: RecordsMove): Promise<RecordsSummary> {
  const summary = await api.moveRecords(move)
  await reloadAll()
  return summary
}

async function deleteRecords(path: string): Promise<RecordsSummary> {
  const summary = await api.deleteRecords(path)
  await reloadAll()
  return summary
}

const documentsByPath = computed(() => new Map(state.documents.map((document) => [document.path, document])))

const latestProgress = computed<DocumentProgress | null>(() => {
  const opened = Object.values(state.progress).filter((entry) => documentsByPath.value.has(entry.path))
  opened.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
  return opened[0] ?? null
})

const orphanRecords = computed<OrphanRecord[]>(() => {
  const paths = new Set([
    ...Object.keys(state.progress),
    ...state.bookmarks.map((item) => item.path),
    ...state.highlights.map((item) => item.path),
  ])
  return [...paths]
    .filter((path) => !documentsByPath.value.has(path))
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((path) => ({
      path,
      hasProgress: state.progress[path] !== undefined,
      bookmarks: state.bookmarks.filter((item) => item.path === path).length,
      highlights: state.highlights.filter((item) => item.path === path).length,
    }))
})

export function useStudyStore() {
  return {
    state,
    documentsByPath,
    latestProgress,
    orphanRecords,
    loadStudyState,
    refreshDocuments,
    saveProgress,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    moveRecords,
    deleteRecords,
  }
}
