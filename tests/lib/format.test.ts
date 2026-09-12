import { describe, expect, it } from 'vitest'
import { formatWhen } from '../../src/lib/format'
import { summarizeProgress } from '../../src/lib/progressSummary'
import type { DocumentProgress } from '../../shared/types'

describe('formatWhen', () => {
  const now = new Date(2026, 8, 11, 20, 0)

  it.each([
    [new Date(2026, 8, 11, 13, 6), '今日 13:06'],
    [new Date(2026, 8, 10, 9, 30), '昨日 9:30'],
    [new Date(2026, 7, 8, 18, 44), '8/8'],
    [new Date(2025, 11, 31, 10, 0), '2025/12/31'],
  ])('%s は %s', (date, expected) => {
    expect(formatWhen(date.toISOString(), now)).toBe(expected)
  })
})

describe('summarizeProgress', () => {
  const progress = (overrides: Partial<DocumentProgress>): DocumentProgress => ({
    path: 'a.html',
    lastOpenedAt: '2026-09-11T04:06:00.000Z',
    position: { sectionId: null, sectionOffset: 0, scrollRatio: 0.42 },
    sectionTitle: null,
    readSectionIds: [],
    sectionCount: 17,
    ...overrides,
  })

  it('開いたことが無ければ未読', () => {
    expect(summarizeProgress(undefined)).toEqual({ ratio: 0, label: '未読', started: false })
  })

  it('読んだ章の数を章の総数と並べる', () => {
    expect(summarizeProgress(progress({ readSectionIds: ['a', 'b', 'c'] }))).toMatchObject({
      ratio: 3 / 17,
      label: '3 / 17 章',
    })
  })

  it('全部読めば読了', () => {
    expect(summarizeProgress(progress({ readSectionIds: ['a', 'b'], sectionCount: 2 })).label).toBe('読了')
  })

  it('章の区切りが無い資料は、読んだ位置の割合で表す', () => {
    expect(summarizeProgress(progress({ sectionCount: 0 })).label).toBe('42%')
  })
})
