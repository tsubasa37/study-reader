import type { Bookmark, DocumentProgress, Highlight } from './schemas'

export type {
  Bookmark,
  BookmarkPatch,
  DocumentProgress,
  Highlight,
  HighlightColorNames,
  HighlightPatch,
  NewBookmark,
  MoveDocument,
  NewHighlight,
  ReadingPosition,
  RecordsMove,
  Settings,
  TextQuote,
} from './schemas'
export type { HighlightColor } from './constants'

export type DocumentEntry = {
  path: string
  name: string
  folder: string
  size: number
  modifiedAt: string
}

export type DocumentList = {
  vaultName: string
  documents: DocumentEntry[]
}

export type StudyState = {
  progress: Record<string, DocumentProgress>
  bookmarks: Bookmark[]
  highlights: Highlight[]
}

export type MoveDocumentResult = {
  path: string
  movedFiles: string[]
  records: RecordsSummary
}

export type RecordsSummary = {
  progress: number
  bookmarks: number
  highlights: number
}

export type ApiErrorBody = {
  error: string
}
