import { computed, reactive } from 'vue'
import { DEFAULT_HIGHLIGHT_COLOR_NAMES } from '../../shared/constants'
import type {
  Bookmark,
  BookmarkPatch,
  DocumentEntry,
  DocumentProgress,
  Highlight,
  HighlightColorNames,
  HighlightPatch,
  MoveDocumentResult,
  NewBookmark,
  NewHighlight,
} from '../../shared/types'
import { api } from '../lib/api'
import { projectFolderOf } from '../lib/projects'

type StoreState = {
  loaded: boolean
  vaultName: string
  documents: DocumentEntry[]
  progress: Record<string, DocumentProgress>
  bookmarks: Bookmark[]
  highlights: Highlight[]
  highlightColorNames: HighlightColorNames
}

const state = reactive<StoreState>({
  loaded: false,
  vaultName: '',
  documents: [],
  progress: {},
  bookmarks: [],
  highlights: [],
  highlightColorNames: { ...DEFAULT_HIGHLIGHT_COLOR_NAMES },
})

let loading: Promise<void> | null = null

async function fetchAll(): Promise<void> {
  const [list, study, settings] = await Promise.all([api.documents(), api.state(), api.settings()])
  state.vaultName = list.vaultName
  state.documents = list.documents
  state.progress = study.progress
  state.bookmarks = study.bookmarks
  state.highlights = study.highlights
  state.highlightColorNames = settings.highlightColorNames
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

async function saveHighlightColorNames(names: HighlightColorNames): Promise<void> {
  const saved = await api.saveSettings({ highlightColorNames: names })
  state.highlightColorNames = saved.highlightColorNames
}

async function reloadAll(): Promise<void> {
  loading = null
  await loadStudyState()
}

// 資料そのものをプロジェクト（フォルダ）へ移す。ファイルと記録はサーバーが一緒に動かす
async function moveDocument(path: string, folder: string): Promise<MoveDocumentResult> {
  const result = await api.moveDocument({ path, folder })
  await reloadAll()
  return result
}

const projectFolders = computed(() =>
  [...new Set(state.documents.map((document) => projectFolderOf(document.path)))]
    .filter((folder) => folder !== '')
    .sort((a, b) => a.localeCompare(b, 'ja')),
)

const documentsByPath = computed(() => new Map(state.documents.map((document) => [document.path, document])))

const latestProgress = computed<DocumentProgress | null>(() => {
  const opened = Object.values(state.progress).filter((entry) => documentsByPath.value.has(entry.path))
  opened.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
  return opened[0] ?? null
})

export function useStudyStore() {
  return {
    state,
    documentsByPath,
    projectFolders,
    latestProgress,
    loadStudyState,
    refreshDocuments,
    saveProgress,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    saveHighlightColorNames,
    moveDocument,
  }
}
