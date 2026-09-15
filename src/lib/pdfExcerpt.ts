import { normalizeSpace } from './textMap'

export type TextBox = { top: number; bottom: number; text: string }

// 読んでいる線にかかるか、それより下にある文字のうち一番上のものから、文書の順に抜き出す。
// PDF の文字の順番は見た目の上下と一致しないことがある（ページ番号が先に来るなど）ので、始まりは位置で選ぶ
export function excerptBelow(boxes: readonly TextBox[], lineY: number, maxLength: number): string {
  let start = -1
  boxes.forEach((box, index) => {
    const current = boxes[start]
    if (box.bottom > lineY && box.text.trim() !== '' && (current === undefined || box.top < current.top)) start = index
  })
  if (start === -1) return ''
  let text = ''
  for (const box of boxes.slice(start)) {
    text += box.text
    if (normalizeSpace(text).length >= maxLength) break
  }
  return normalizeSpace(text).slice(0, maxLength).trimEnd()
}
