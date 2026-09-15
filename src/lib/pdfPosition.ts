import type { SectionBox } from './position'

// PDF はページを章の代わりにする。記録の章の欄には「page-ページ番号」を入れる
const PAGE_PREFIX = 'page-'

export const pageSectionId = (pageNumber: number): string => `${PAGE_PREFIX}${pageNumber}`

export function pageNumberOf(sectionId: string | null): number | null {
  if (sectionId === null || !sectionId.startsWith(PAGE_PREFIX)) return null
  const pageNumber = Number(sectionId.slice(PAGE_PREFIX.length))
  return Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : null
}

// 1ページ目から順に並んだページの位置と高さを、位置の計算に使う章の箱にする
export function pageBoxes(pages: readonly { top: number; height: number }[]): SectionBox[] {
  return pages.map((page, index) => ({ id: pageSectionId(index + 1), top: page.top, height: page.height }))
}
