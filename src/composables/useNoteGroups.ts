import { computed, type Ref } from 'vue'
import { locateQuote } from '../lib/anchoring'
import { bookmarkToNote, highlightToNote } from '../lib/notes'
import { projectFolderOf } from '../lib/projects'
import type { IndexedDocument } from '../lib/search'
import { matchesText } from '../lib/search'
import type {
  ColorCounts,
  HighlightFilter,
  HighlightTree,
  NoteGroup,
  NoteHit,
  NoteListEntry,
  NotePlace,
  TreeDocument,
} from '../types/ui'
import { useStudyStore } from './useStudyStore'

const ALL_PLACES: NotePlace = { kind: 'all' }

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) => b.createdAt.localeCompare(a.createdAt)

const inPlace = (entry: NoteListEntry, place: NotePlace) =>
  place.kind === 'all' ||
  (place.kind === 'project' ? projectFolderOf(entry.path) === place.folder : entry.path === place.path)

// しおりは新しい順に並べるだけ。ハイライトは資料の木と色の名前で絞り込み、見失ったものに印を付ける
export function useNoteGroups(filter: Ref<HighlightFilter>, indexed: Ref<IndexedDocument[]>) {
  const store = useStudyStore()

  const nameOf = (path: string) => store.documentsByPath.value.get(path)?.name ?? path

  const highlights = computed<NoteListEntry[]>(() => {
    const texts = new Map(indexed.value.map((document) => [document.path, document.text]))
    return store.state.highlights.map((item) => {
      const text = texts.get(item.path)
      // 本文を読み込めている資料だけ、ハイライトが見つかるかを見る
      return { ...highlightToNote(item), lost: text !== undefined && locateQuote(text, item.quote) === null }
    })
  })

  const bookmarks = computed<NoteHit[]>(() =>
    store.state.bookmarks.map((item) => ({ ...bookmarkToNote(item), name: nameOf(item.path) })).sort(newestFirst),
  )

  const counts = computed(() => ({ highlight: store.state.highlights.length, bookmark: store.state.bookmarks.length }))

  // 本棚と同じ並び。プロジェクト名順に資料を並べ、フォルダに入れていない資料は最後
  const shelfOrder = computed(() => {
    const inFolder = (folder: string) =>
      store.state.documents.filter((document) => projectFolderOf(document.path) === folder)
    const ordered = [...store.projectFolders.value.flatMap(inFolder), ...inFolder('')]
    return new Map(ordered.map((document, index) => [document.path, index]))
  })
  const byShelf = (a: string, b: string) =>
    (shelfOrder.value.get(a) ?? Number.MAX_SAFE_INTEGER) - (shelfOrder.value.get(b) ?? Number.MAX_SAFE_INTEGER)

  const matchesColor = (entry: NoteListEntry) => filter.value.color === null || entry.color === filter.value.color
  const matchesQuery = (entry: NoteListEntry) =>
    filter.value.text.trim() === '' || matchesText([entry.text, entry.memo, entry.sectionTitle ?? ''], filter.value.text)

  // ハイライトが2つ以上の資料にまたがるときだけ、資料で絞り込む木を出す
  const tree = computed<HighlightTree | null>(() => {
    const paths = [...new Set(highlights.value.map((entry) => entry.path))].sort(byShelf)
    if (paths.length < 2) return null
    const counted = highlights.value.filter((entry) => matchesColor(entry) && matchesQuery(entry))
    const documentsIn = (folder: string): TreeDocument[] =>
      paths
        .filter((path) => projectFolderOf(path) === folder)
        .map((path) => ({ path, name: nameOf(path), count: counted.filter((entry) => entry.path === path).length }))
    const folders = [...new Set(paths.map(projectFolderOf))].filter((folder) => folder !== '')
    return {
      count: counted.length,
      projects: folders.map((folder) => {
        const documents = documentsIn(folder)
        return { folder, count: documents.reduce((sum, document) => sum + document.count, 0), documents }
      }),
      loose: documentsIn(''),
    }
  })

  const placed = computed(() => {
    const place = tree.value === null ? ALL_PLACES : filter.value.place
    return highlights.value.filter((entry) => inPlace(entry, place) && matchesQuery(entry))
  })

  const colorCounts = computed<ColorCounts>(() => {
    const result: ColorCounts = { all: placed.value.length, yellow: 0, green: 0, pink: 0, blue: 0 }
    for (const entry of placed.value) if (entry.color !== null) result[entry.color]++
    return result
  })

  const groups = computed<NoteGroup[]>(() => {
    const byPath = new Map<string, NoteListEntry[]>()
    for (const entry of placed.value.filter(matchesColor)) byPath.set(entry.path, [...(byPath.get(entry.path) ?? []), entry])
    return [...byPath.entries()]
      .sort(([a], [b]) => byShelf(a, b))
      .map(([path, entries]) => ({
        path,
        name: nameOf(path),
        project: projectFolderOf(path),
        entries: entries.sort(newestFirst),
      }))
  })

  const total = computed(() => groups.value.reduce((sum, group) => sum + group.entries.length, 0))

  return { groups, total, tree, colorCounts, bookmarks, counts }
}
