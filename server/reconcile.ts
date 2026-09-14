import type { DocumentEntry } from '../shared/types'
import type { StudyRepository } from './studyRepository'

const fileNameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

// 資料フォルダの中身を正として、記録の名札を実際のファイルに合わせる。
// 利用者に判断を求めず、画面にも出さない。行き先が決められない記録はしまっておく
export async function reconcileRecords(
  repository: StudyRepository,
  documents: readonly DocumentEntry[],
): Promise<void> {
  const known = new Set(documents.map((document) => document.path))
  const byName = new Map<string, string[]>()
  for (const document of documents) {
    const name = fileNameOf(document.path)
    byName.set(name, [...(byName.get(name) ?? []), document.path])
  }
  // 同じファイル名が1つだけのときに限り、その資料のことだと判断する
  const soleMatch = (path: string): string | null => {
    const matches = byName.get(fileNameOf(path)) ?? []
    return matches.length === 1 ? (matches[0] ?? null) : null
  }

  const state = await repository.state()
  const recorded = new Set([
    ...Object.keys(state.progress),
    ...state.bookmarks.map((item) => item.path),
    ...state.highlights.map((item) => item.path),
  ])
  // すでに記録を持つ資料へは付け替えない。同じ名前の別の資料に記録が混ざるのを防ぐ
  const occupied = new Set([...recorded].filter((path) => known.has(path)))
  const vacantMatch = (path: string): string | null => {
    const target = soleMatch(path)
    return target !== null && !occupied.has(target) ? target : null
  }

  for (const path of recorded) {
    if (known.has(path)) continue
    const target = vacantMatch(path)
    if (target === null) {
      await repository.archiveRecords(path)
      continue
    }
    await repository.relocateRecords(path, target)
    occupied.add(target)
  }

  // しまってある記録は、同じ名前の資料が戻ってきたら元に戻す
  for (const path of await repository.archivedPaths()) {
    const target = known.has(path) ? path : vacantMatch(path)
    if (target === null) continue
    await repository.restoreArchived(path, target)
    occupied.add(target)
  }
}
