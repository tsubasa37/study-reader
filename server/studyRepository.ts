import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  BookmarksFileSchema,
  HighlightsFileSchema,
  ProgressFileSchema,
  type BookmarksFile,
  type DocumentProgress,
  type HighlightsFile,
  type NewBookmark,
  type NewHighlight,
  type ProgressFile,
  type RecordsMove,
} from '../shared/schemas'
import type { RecordsSummary, StudyState } from '../shared/types'
import { HttpError } from './errors'
import { JsonStore } from './store'
import { STATE_DIR_NAME } from './vault'

type Entity = { id: string; path: string; createdAt: string; updatedAt: string }
type ListFile<T> = { version: 1; items: T[] }

const timestamp = () => new Date().toISOString()

function createCollection<New extends { path: string }>(store: JsonStore<ListFile<New & Entity>>, notFound: string) {
  return {
    add(input: New): Promise<New & Entity> {
      const now = timestamp()
      const item = { ...input, id: randomUUID(), createdAt: now, updatedAt: now }
      return store.update((file) => ({ next: { ...file, items: [...file.items, item] }, result: item }))
    },
    update(id: string, patch: Partial<New>): Promise<New & Entity> {
      return store.update((file) => {
        const index = file.items.findIndex((item) => item.id === id)
        const current = file.items[index]
        if (current === undefined) throw new HttpError(404, notFound)
        const item = { ...current, ...patch, updatedAt: timestamp() }
        return { next: { ...file, items: file.items.with(index, item) }, result: item }
      })
    },
    remove(id: string): Promise<void> {
      return store.update((file) => {
        if (!file.items.some((item) => item.id === id)) throw new HttpError(404, notFound)
        return { next: { ...file, items: file.items.filter((item) => item.id !== id) }, result: undefined }
      })
    },
    repath(from: string, to: string): Promise<void> {
      return store.update((file) => ({
        next: {
          ...file,
          items: file.items.map((item) => (item.path === from ? { ...item, path: to, updatedAt: timestamp() } : item)),
        },
        result: undefined,
      }))
    },
    removeByPath(path: string): Promise<void> {
      return store.update((file) => ({
        next: { ...file, items: file.items.filter((item) => item.path !== path) },
        result: undefined,
      }))
    },
  }
}

function mergeProgress(source: DocumentProgress, target: DocumentProgress | undefined, path: string): DocumentProgress {
  if (target === undefined) return { ...source, path }
  const newer = source.lastOpenedAt > target.lastOpenedAt ? source : target
  const readSectionIds = [...new Set([...source.readSectionIds, ...target.readSectionIds])]
  return { ...newer, path, readSectionIds }
}

export function createStudyRepository(vaultDir: string) {
  const dir = join(vaultDir, STATE_DIR_NAME)
  const progress = new JsonStore<ProgressFile>(join(dir, 'progress.json'), ProgressFileSchema, () => ({
    version: 1,
    documents: {},
  }))
  const bookmarkStore = new JsonStore<BookmarksFile>(join(dir, 'bookmarks.json'), BookmarksFileSchema, () => ({
    version: 1,
    items: [],
  }))
  const highlightStore = new JsonStore<HighlightsFile>(join(dir, 'highlights.json'), HighlightsFileSchema, () => ({
    version: 1,
    items: [],
  }))

  const bookmarks = createCollection<NewBookmark>(bookmarkStore, 'しおりが見つかりません')
  const highlights = createCollection<NewHighlight>(highlightStore, 'ハイライトが見つかりません')

  async function state(): Promise<StudyState> {
    const [progressFile, bookmarksFile, highlightsFile] = await Promise.all([
      progress.read(),
      bookmarkStore.read(),
      highlightStore.read(),
    ])
    return { progress: progressFile.documents, bookmarks: bookmarksFile.items, highlights: highlightsFile.items }
  }

  async function countRecords(path: string): Promise<RecordsSummary> {
    const current = await state()
    return {
      progress: current.progress[path] === undefined ? 0 : 1,
      bookmarks: current.bookmarks.filter((item) => item.path === path).length,
      highlights: current.highlights.filter((item) => item.path === path).length,
    }
  }

  const isEmpty = (summary: RecordsSummary) => summary.progress + summary.bookmarks + summary.highlights === 0

  async function summarize(path: string): Promise<RecordsSummary> {
    const summary = await countRecords(path)
    if (isEmpty(summary)) throw new HttpError(404, `${path} の記録はありません`)
    return summary
  }

  async function relocate(from: string, to: string): Promise<void> {
    await progress.update((file) => {
      const source = file.documents[from]
      if (source === undefined) return { next: file, result: undefined }
      const documents = { ...file.documents }
      delete documents[from]
      documents[to] = mergeProgress(source, documents[to], to)
      return { next: { ...file, documents }, result: undefined }
    })
    await bookmarks.repath(from, to)
    await highlights.repath(from, to)
  }

  return {
    state,
    bookmarks,
    highlights,

    saveProgress(entry: DocumentProgress): Promise<DocumentProgress> {
      return progress.update((file) => ({
        next: { ...file, documents: { ...file.documents, [entry.path]: entry } },
        result: entry,
      }))
    },

    async moveRecords({ from, to }: RecordsMove): Promise<RecordsSummary> {
      const summary = await summarize(from)
      await relocate(from, to)
      return summary
    },

    // 資料そのものを移したときの付け替え。まだ記録が無い資料でも失敗しない
    async relocateRecords(from: string, to: string): Promise<RecordsSummary> {
      const summary = await countRecords(from)
      if (!isEmpty(summary)) await relocate(from, to)
      return summary
    },

    async deleteRecords(path: string): Promise<RecordsSummary> {
      const summary = await summarize(path)
      await progress.update((file) => {
        const documents = { ...file.documents }
        delete documents[path]
        return { next: { ...file, documents }, result: undefined }
      })
      await bookmarks.removeByPath(path)
      await highlights.removeByPath(path)
      return summary
    },
  }
}

export type StudyRepository = ReturnType<typeof createStudyRepository>
