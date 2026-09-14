import { describe, expect, it } from 'vitest'
import {
  READ_DWELL_MS,
  READING_LINE,
  finishedSectionIds,
  positionAt,
  scrollTopFor,
  visibleSectionIds,
  type SectionBox,
} from '../../src/lib/position'

const boxes: SectionBox[] = [
  { id: 'part1', top: 0, height: 1000 },
  { id: 'ch1', top: 100, height: 400 },
  { id: 'ch2', top: 500, height: 500 },
  { id: 'ch3', top: 1200, height: 300 },
]

describe('positionAt', () => {
  it('読んでいる線より上で始まった一番深い章と、その章の中の割合を返す', () => {
    expect(positionAt(boxes, 300 - READING_LINE, 1400)).toEqual({
      sectionId: 'ch1',
      sectionOffset: 0.5,
      scrollRatio: (300 - READING_LINE) / 1400,
    })
  })

  it('章と章のすき間は、直前の章の終わりとして扱う', () => {
    expect(positionAt(boxes, 1100 - READING_LINE, 1400)).toMatchObject({ sectionId: 'ch2', sectionOffset: 1 })
  })

  it('最初の章より前は、全体の割合だけ返す', () => {
    const later = boxes.map((box) => ({ ...box, top: box.top + 500 }))

    expect(positionAt(later, 0, 1400)).toEqual({ sectionId: null, sectionOffset: 0, scrollRatio: 0 })
  })

  it('表示されていない章（高さ 0）は数えない', () => {
    const hidden = [...boxes, { id: 'hidden', top: 0, height: 0 }]

    expect(positionAt(hidden, 300 - READING_LINE, 1400).sectionId).toBe('ch1')
  })
})

describe('scrollTopFor', () => {
  it('章が見つかれば、保存したときと同じ位置に戻す', () => {
    const saved = positionAt(boxes, 670, 1400)

    expect(scrollTopFor(boxes, saved, 1400)).toEqual({ top: 670, sectionFound: true })
  })

  it('章が見つからなければ、全体の割合で戻し、見つからなかったことを返す', () => {
    expect(scrollTopFor(boxes, { sectionId: 'gone', sectionOffset: 0.5, scrollRatio: 0.5 }, 1400)).toEqual({
      top: 700,
      sectionFound: false,
    })
  })

  it('章を覚えていない位置は全体の割合で戻す', () => {
    expect(scrollTopFor(boxes, { sectionId: null, sectionOffset: 0, scrollRatio: 0.25 }, 1400)).toEqual({
      top: 350,
      sectionFound: true,
    })
  })
})

describe('visibleSectionIds', () => {
  it('画面に少しでも入っている章を返し、上に抜けた章とまだ下にある章は除く', () => {
    // 画面は 500〜1200。ch1 は 500 で終わり、ch3 は 1200 から始まる
    expect(visibleSectionIds(boxes, 500, 700)).toEqual(['part1', 'ch2'])
  })

  it('表示されていない章（高さ 0）は数えない', () => {
    const hidden = [...boxes, { id: 'hidden', top: 600, height: 0 }]

    expect(visibleSectionIds(hidden, 500, 700)).toEqual(['part1', 'ch2'])
  })
})

describe('finishedSectionIds', () => {
  const leaves = boxes.filter((box) => box.id !== 'part1')
  const read = new Map([
    ['ch1', READ_DWELL_MS],
    ['ch2', READ_DWELL_MS * 3],
    ['ch3', READ_DWELL_MS],
  ])

  it('しばらく読んでいて、章の終わりが画面に入った章を返す', () => {
    expect(finishedSectionIds(leaves, 300, 800, read)).toEqual(['ch1', 'ch2'])
  })

  it('章の終わりが画面上端のすぐ近くなら、まだ読み終えたとみなさない', () => {
    expect(finishedSectionIds(leaves, 480, 800, read)).toEqual(['ch2'])
  })

  it('目次リンクで通り過ぎただけの章（滞在がごく短い）は読み終えたとみなさない', () => {
    const passedThrough = new Map([
      ['ch1', 120],
      ['ch2', READ_DWELL_MS],
    ])

    expect(finishedSectionIds(leaves, 300, 800, passedThrough)).toEqual(['ch2'])
  })
})
