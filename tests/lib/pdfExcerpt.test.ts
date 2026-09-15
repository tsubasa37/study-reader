import { describe, expect, it } from 'vitest'
import { excerptBelow, type TextBox } from '../../src/lib/pdfExcerpt'

const box = (top: number, text: string): TextBox => ({ top, bottom: top + 20, text })

describe('excerptBelow', () => {
  it('読んでいる線にかかる行から文書の順につなぎ、空白をまとめて決めた長さで切る', () => {
    const boxes = [box(0, '上の行'), box(90, '4-2. ref  - '), box(120, '1つの値を入れる箱'), box(150, 'const count = ref(0)')]

    expect(excerptBelow(boxes, 100, 20)).toBe('4-2. ref - 1つの値を入れる箱')
  })

  it('ちょうど切った位置が行の終わりの空白でも、末尾に空白を残さない', () => {
    expect(excerptBelow([box(110, '箱を '), box(130, '作る')], 100, 3)).toBe('箱を')
  })

  it('線より上で終わる行は抜き出さない', () => {
    expect(excerptBelow([box(0, '見出し'), box(200, '本文')], 100, 80)).toBe('本文')
  })

  it('ページ番号が文書の順で先に来ても、線より下で一番上の文字から始める', () => {
    const boxes = [box(900, '15'), box(300, '本文の書き出し'), box(330, 'の続き')]

    expect(excerptBelow(boxes, 280, 80)).toBe('本文の書き出しの続き')
  })

  it('空白だけの文字は始まりに選ばない', () => {
    expect(excerptBelow([box(110, '  '), box(130, '本文')], 100, 80)).toBe('本文')
  })

  it('線より下に文字が無ければ空にする', () => {
    expect(excerptBelow([box(0, '上の行')], 100, 80)).toBe('')
  })
})
