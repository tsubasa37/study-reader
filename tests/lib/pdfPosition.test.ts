import { describe, expect, it } from 'vitest'
import { pageBoxes, pageNumberOf, pageSectionId } from '../../src/lib/pdfPosition'
import { READING_LINE, positionAt, scrollTopFor } from '../../src/lib/position'

// 同じ大きさのページが縦に並ぶ。ページとページの間は 10px
const layout = (pageCount: number, pageHeight: number) =>
  Array.from({ length: pageCount }, (_, index) => ({ top: index * (pageHeight + 10), height: pageHeight }))

describe('ページの目印', () => {
  it('ページ番号と記録の章の欄の値を行き来できる', () => {
    expect(pageSectionId(21)).toBe('page-21')
    expect(pageNumberOf('page-21')).toBe(21)
  })

  it.each([null, 'ch1', 'page-', 'page-0', 'page-1.5', 'page-abc'])('%s はページの目印ではない', (sectionId) => {
    expect(pageNumberOf(sectionId)).toBeNull()
  })
})

describe('pageBoxes', () => {
  it('1ページ目から順に page-1, page-2 … の箱にする', () => {
    expect(pageBoxes(layout(2, 800))).toEqual([
      { id: 'page-1', top: 0, height: 800 },
      { id: 'page-2', top: 810, height: 800 },
    ])
  })

  it('拡大率を変えても、保存したページの同じ辺りへ戻せる', () => {
    const saved = positionAt(pageBoxes(layout(5, 800)), 1900, 3000)
    expect(saved).toMatchObject({ sectionId: 'page-3', sectionOffset: (1900 + READING_LINE - 1620) / 800 })

    const zoomed = pageBoxes(layout(5, 1200))
    const { top, sectionFound } = scrollTopFor(zoomed, saved, 6000)

    expect(sectionFound).toBe(true)
    expect(positionAt(zoomed, top, 6000)).toMatchObject({ sectionId: 'page-3' })
    expect(top).toBeCloseTo(2420 + 1200 * saved.sectionOffset - READING_LINE)
  })
})
