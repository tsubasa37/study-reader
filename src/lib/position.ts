import type { ReadingPosition } from '../../shared/types'

export type SectionBox = {
  id: string
  top: number
  height: number
}

// 画面上端からこの距離の線を「今読んでいる所」とする。保存と復元で同じ値を使うので位置がずれない
export const READING_LINE = 80

// 章の終わりがこの距離より下に見えていれば、その章を読み終えたとみなす
const FINISH_MARGIN = 40

// 読んでいる線がこの時間その章にとどまったら、通り過ぎたのではなく読んだとみなす
export const READ_DWELL_MS = 4000

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

// 読んでいる線より上で始まった最後の章（入れ子なら深い方）と、その章の中で何割進んだかを求める。
// 章と章のすき間は直前の章の終わりとして扱う
export function positionAt(boxes: readonly SectionBox[], scrollTop: number, maxScroll: number): ReadingPosition {
  const line = scrollTop + READING_LINE
  let current: SectionBox | undefined
  for (const box of boxes) {
    if (box.height > 0 && box.top <= line) current = box
  }
  const scrollRatio = maxScroll > 0 ? clamp(scrollTop / maxScroll) : 0
  if (current === undefined) return { sectionId: null, sectionOffset: 0, scrollRatio }
  return { sectionId: current.id, sectionOffset: clamp((line - current.top) / current.height), scrollRatio }
}

export function scrollTopFor(
  boxes: readonly SectionBox[],
  position: ReadingPosition,
  maxScroll: number,
): { top: number; sectionFound: boolean } {
  const byRatio = clamp(position.scrollRatio) * maxScroll
  if (position.sectionId === null) return { top: byRatio, sectionFound: true }
  const box = boxes.find((candidate) => candidate.id === position.sectionId)
  if (box === undefined) return { top: byRatio, sectionFound: false }
  const top = box.top + box.height * position.sectionOffset - READING_LINE
  return { top: clamp(top, 0, maxScroll), sectionFound: true }
}

// 読み終えた章 = しばらく読んでいた章のうち、章の終わりが画面に見えている章。
// 目次リンクで一気に飛んだときは、通過した章の滞在時間がごく短いので既読にならない
export function finishedSectionIds(
  leafBoxes: readonly SectionBox[],
  scrollTop: number,
  viewportHeight: number,
  dwellMs: ReadonlyMap<string, number>,
  minDwellMs: number = READ_DWELL_MS,
): string[] {
  const viewBottom = scrollTop + viewportHeight
  return leafBoxes
    .filter((box) => {
      const bottom = box.top + box.height
      return (
        box.height > 0 &&
        (dwellMs.get(box.id) ?? 0) >= minDwellMs &&
        bottom <= viewBottom &&
        bottom > scrollTop + FINISH_MARGIN
      )
    })
    .map((box) => box.id)
}
