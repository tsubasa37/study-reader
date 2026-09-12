import type { HighlightColor, TextQuote } from '../../shared/types'
import type { DocSection } from '../lib/sections'
import type { TextMap } from '../lib/textMap'

export type OrphanRecord = {
  path: string
  hasProgress: boolean
  bookmarks: number
  highlights: number
}

export type PanelTab = 'toc' | 'bookmarks' | 'highlights'

export type ReaderSession = {
  win: Window
  doc: Document
  sections: DocSection[]
  leafIds: ReadonlySet<string>
  textMap: () => TextMap
}

export type SelectionDraft = {
  quote: TextQuote
  sectionId: string | null
  sectionTitle: string | null
  x: number
  top: number
  bottom: number
}

export type HighlightAnchor = {
  start: number
  range: Range
}

export type PaintEntry = {
  color: HighlightColor
  range: Range
}

export type JumpTarget = {
  path: string
  quote: TextQuote
}

export type TocEntry = {
  id: string
  title: string
  depth: number
  isLeaf: boolean
  read: boolean
  current: boolean
}

export type NoteEntry = {
  kind: 'bookmark' | 'highlight'
  id: string
  path: string
  sectionTitle: string | null
  text: string
  memo: string
  color: HighlightColor | null
  createdAt: string
}

// 一覧では「位置を見失ったか」を、検索結果では資料名を添える
export type NoteListEntry = NoteEntry & { lost: boolean }
export type NoteHit = NoteEntry & { name: string }

export type NoteGroup = {
  path: string
  name: string
  missing: boolean
  entries: NoteListEntry[]
}

