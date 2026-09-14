import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  ArchiveFileSchema,
  BookmarksFileSchema,
  HighlightsFileSchema,
  ProgressFileSchema,
  SettingsFileSchema,
  type BookmarksFile,
  type DocumentProgress,
  type HighlightsFile,
  type NewBookmark,
  type NewHighlight,
  type ArchiveFile,
  type ProgressFile,
  type Settings,
  type SettingsFile,
} from '../shared/schemas'
import { DEFAULT_HIGHLIGHT_COLOR_NAMES } from '../shared/constants'
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
  // 資料フォルダから消えた資料の記録。画面には出さず、同じ名前の資料が戻れば元に戻す
  const archiveStore = new JsonStore<ArchiveFile>(join(dir, 'archive.json'), ArchiveFileSchema, () => ({
    version: 1,
    progress: {},
    bookmarks: [],
    highlights: [],
  }))
  const settingsStore = new JsonStore<SettingsFile>(join(dir, 'settings.json'), SettingsFileSchema, () => ({
    version: 1,
    highlightColorNames: { ...DEFAULT_HIGHLIGHT_COLOR_NAMES },
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

    async settings(): Promise<Settings> {
      const { highlightColorNames } = await settingsStore.read()
      return { highlightColorNames }
    },

    saveSettings(settings: Settings): Promise<Settings> {
      return settingsStore.update((file) => ({ next: { ...file, ...settings }, result: settings }))
    },

    // 資料そのものを移したときの付け替え。まだ記録が無い資料でも失敗しない
    async relocateRecords(from: string, to: string): Promise<RecordsSummary> {
      const summary = await countRecords(from)
      if (!isEmpty(summary)) await relocate(from, to)
      return summary
    },

    // 資料フォルダから消えた資料の記録を、画面に出さない置き場へ移す（消しはしない）
    async archiveRecords(path: string): Promise<RecordsSummary> {
      const summary = await countRecords(path)
      if (isEmpty(summary)) return summary
      const current = await state()
      const entry = current.progress[path]
      const movedBookmarks = current.bookmarks.filter((item) => item.path === path)
      const movedHighlights = current.highlights.filter((item) => item.path === path)
      await archiveStore.update((file) => ({
        next: {
          ...file,
          progress: entry === undefined ? file.progress : { ...file.progress, [path]: entry },
          bookmarks: [...file.bookmarks.filter((item) => item.path !== path), ...movedBookmarks],
          highlights: [...file.highlights.filter((item) => item.path !== path), ...movedHighlights],
        },
        result: undefined,
      }))
      await progress.update((file) => {
        const documents = { ...file.documents }
        delete documents[path]
        return { next: { ...file, documents }, result: undefined }
      })
      await bookmarks.removeByPath(path)
      await highlights.removeByPath(path)
      return summary
    },

    // しまっておいた記録を、戻ってきた資料に結び付け直す
    async restoreArchived(archivedPath: string, to: string): Promise<RecordsSummary> {
      const archive = await archiveStore.read()
      const entry = archive.progress[archivedPath]
      const movedBookmarks = archive.bookmarks.filter((item) => item.path === archivedPath)
      const movedHighlights = archive.highlights.filter((item) => item.path === archivedPath)
      const summary = {
        progress: entry === undefined ? 0 : 1,
        bookmarks: movedBookmarks.length,
        highlights: movedHighlights.length,
      }
      if (isEmpty(summary)) return summary
      if (entry !== undefined) {
        await progress.update((file) => ({
          next: {
            ...file,
            documents: { ...file.documents, [to]: mergeProgress(entry, file.documents[to], to) },
          },
          result: undefined,
        }))
      }
      const stamp = timestamp()
      await bookmarkStore.update((file) => ({
        next: { ...file, items: [...file.items, ...movedBookmarks.map((item) => ({ ...item, path: to, updatedAt: stamp }))] },
        result: undefined,
      }))
      await highlightStore.update((file) => ({
        next: { ...file, items: [...file.items, ...movedHighlights.map((item) => ({ ...item, path: to, updatedAt: stamp }))] },
        result: undefined,
      }))
      await archiveStore.update((file) => {
        const remaining = { ...file.progress }
        delete remaining[archivedPath]
        return {
          next: {
            ...file,
            progress: remaining,
            bookmarks: file.bookmarks.filter((item) => item.path !== archivedPath),
            highlights: file.highlights.filter((item) => item.path !== archivedPath),
          },
          result: undefined,
        }
      })
      return summary
    },

    async archivedPaths(): Promise<string[]> {
      const archive = await archiveStore.read()
      return [
        ...new Set([
          ...Object.keys(archive.progress),
          ...archive.bookmarks.map((item) => item.path),
          ...archive.highlights.map((item) => item.path),
        ]),
      ]
    },
  }
}

export type StudyRepository = ReturnType<typeof createStudyRepository>
