import { z } from 'zod'
import { HIGHLIGHT_COLORS } from './constants'

const documentPath = z.string().min(1).max(1024)
const timestamp = z.iso.datetime()
const ratio = z.number().min(0).max(1)
const memo = z.string().max(5000)

export const ReadingPositionSchema = z.object({
  sectionId: z.string().min(1).nullable(),
  sectionOffset: ratio,
  scrollRatio: ratio,
})

export const DocumentProgressSchema = z.object({
  path: documentPath,
  lastOpenedAt: timestamp,
  position: ReadingPositionSchema,
  sectionTitle: z.string().nullable(),
  readSectionIds: z.array(z.string().min(1).max(200)).max(5000),
  sectionCount: z.number().int().min(0).max(10000),
})

export const TextQuoteSchema = z.object({
  exact: z.string().min(1).max(2000),
  prefix: z.string().max(200),
  suffix: z.string().max(200),
  start: z.number().int().min(0),
})

export const HighlightColorSchema = z.enum(HIGHLIGHT_COLORS)

export const HighlightSchema = z.object({
  id: z.string().min(1),
  path: documentPath,
  sectionId: z.string().min(1).nullable(),
  sectionTitle: z.string().nullable(),
  quote: TextQuoteSchema,
  color: HighlightColorSchema,
  memo,
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const BookmarkSchema = z.object({
  id: z.string().min(1),
  path: documentPath,
  position: ReadingPositionSchema,
  sectionTitle: z.string().nullable(),
  excerpt: z.string().max(300),
  memo,
  createdAt: timestamp,
  updatedAt: timestamp,
})

export const NewBookmarkSchema = BookmarkSchema.pick({
  path: true,
  position: true,
  sectionTitle: true,
  excerpt: true,
  memo: true,
})

export const NewHighlightSchema = HighlightSchema.pick({
  path: true,
  sectionId: true,
  sectionTitle: true,
  quote: true,
  color: true,
  memo: true,
})

export const BookmarkPatchSchema = z.object({ memo })

export const HighlightPatchSchema = z
  .object({ memo: memo.optional(), color: HighlightColorSchema.optional() })
  .refine((patch) => patch.memo !== undefined || patch.color !== undefined, {
    message: '変更する項目がありません',
  })

export const RecordsMoveSchema = z
  .object({ from: documentPath, to: documentPath })
  .refine((move) => move.from !== move.to, { message: '引き継ぎ元と引き継ぎ先が同じです' })

export const MoveDocumentSchema = z.object({
  path: documentPath,
  // '' は資料フォルダ直下（プロジェクトから出す）
  folder: z.string().max(200),
})

export const ProgressFileSchema = z.object({
  version: z.literal(1),
  documents: z.record(z.string(), DocumentProgressSchema),
})

export const BookmarksFileSchema = z.object({
  version: z.literal(1),
  items: z.array(BookmarkSchema),
})

export const HighlightsFileSchema = z.object({
  version: z.literal(1),
  items: z.array(HighlightSchema),
})

// 資料フォルダから消えた資料の記録を、画面に出さずにしまっておく置き場
export const ArchiveFileSchema = z.object({
  version: z.literal(1),
  progress: z.record(z.string(), DocumentProgressSchema),
  bookmarks: z.array(BookmarkSchema),
  highlights: z.array(HighlightSchema),
})

export type ReadingPosition = z.infer<typeof ReadingPositionSchema>
export type DocumentProgress = z.infer<typeof DocumentProgressSchema>
export type TextQuote = z.infer<typeof TextQuoteSchema>
export type Highlight = z.infer<typeof HighlightSchema>
export type Bookmark = z.infer<typeof BookmarkSchema>
export type NewBookmark = z.infer<typeof NewBookmarkSchema>
export type NewHighlight = z.infer<typeof NewHighlightSchema>
export type BookmarkPatch = z.infer<typeof BookmarkPatchSchema>
export type HighlightPatch = z.infer<typeof HighlightPatchSchema>
export type RecordsMove = z.infer<typeof RecordsMoveSchema>
export type MoveDocument = z.infer<typeof MoveDocumentSchema>
export type ProgressFile = z.infer<typeof ProgressFileSchema>
export type BookmarksFile = z.infer<typeof BookmarksFileSchema>
export type HighlightsFile = z.infer<typeof HighlightsFileSchema>
export type ArchiveFile = z.infer<typeof ArchiveFileSchema>
