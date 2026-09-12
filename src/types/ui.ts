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
  lost: boolean
}

export type NoteGroup = {
  path: string
  name: string
  missing: boolean
  entries: NoteEntry[]
}

export type NoteHit =
  | { kind: 'bookmark'; id: string; path: string; name: string; sectionTitle: string | null; text: string; memo: string }
  | { kind: 'highlight'; id: string; path: string; name: string; sectionTitle: string | null; text: string; memo: string; color: HighlightColor }
