import type { Bookmark, DocumentEntry, DocumentProgress, Highlight } from '../../shared/types'

export type ProjectSummary = {
  folder: string
  documents: DocumentEntry[]
  openedDocuments: number
  readSections: number
  totalSections: number
  bookmarks: number
  highlights: number
  lastOpenedAt: string | null
  lastDocument: { path: string; name: string; sectionTitle: string | null } | null
}

export type Shelf = {
  projects: ProjectSummary[]
  loose: DocumentEntry[]
}

// プロジェクト = 資料フォルダの直下のフォルダ。その下がさらに入れ子でも同じプロジェクトに入れる
export function projectFolderOf(path: string): string {
  const index = path.indexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function summarize(
  folder: string,
  documents: DocumentEntry[],
  progress: Readonly<Record<string, DocumentProgress>>,
  bookmarks: readonly Bookmark[],
  highlights: readonly Highlight[],
): ProjectSummary {
  const paths = new Set(documents.map((document) => document.path))
  let openedDocuments = 0
  let readSections = 0
  let totalSections = 0
  let lastOpenedAt: string | null = null
  let lastDocument: ProjectSummary['lastDocument'] = null

  for (const document of documents) {
    const entry = progress[document.path]
    if (entry === undefined) continue
    openedDocuments++
    // 章の数は資料を開いて初めて分かるので、合計は開いた資料の分だけ
    totalSections += entry.sectionCount
    readSections += Math.min(entry.readSectionIds.length, entry.sectionCount)
    if (lastOpenedAt === null || entry.lastOpenedAt > lastOpenedAt) {
      lastOpenedAt = entry.lastOpenedAt
      lastDocument = { path: document.path, name: document.name, sectionTitle: entry.sectionTitle }
    }
  }

  return {
    folder,
    documents,
    openedDocuments,
    readSections,
    totalSections,
    bookmarks: bookmarks.filter((item) => paths.has(item.path)).length,
    highlights: highlights.filter((item) => paths.has(item.path)).length,
    lastOpenedAt,
    lastDocument,
  }
}

export function groupIntoProjects(
  documents: readonly DocumentEntry[],
  progress: Readonly<Record<string, DocumentProgress>>,
  bookmarks: readonly Bookmark[],
  highlights: readonly Highlight[],
): Shelf {
  const loose: DocumentEntry[] = []
  const byFolder = new Map<string, DocumentEntry[]>()
  for (const document of documents) {
    const folder = projectFolderOf(document.path)
    if (folder === '') {
      loose.push(document)
      continue
    }
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), document])
  }
  const projects = [...byFolder.entries()]
    .map(([folder, entries]) => summarize(folder, entries, progress, bookmarks, highlights))
    .sort((a, b) => a.folder.localeCompare(b.folder, 'ja'))
  return { projects, loose }
}

