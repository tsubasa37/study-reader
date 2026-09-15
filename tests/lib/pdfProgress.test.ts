import { describe, expect, it } from 'vitest'
import type { DocumentProgress } from '../../shared/types'
import type { PdfTocEntry } from '../../src/lib/pdfOutline'
import { pdfProgressEntry } from '../../src/lib/pdfProgress'

const outline: PdfTocEntry[] = [
  { id: 'a', title: '03 SFC（.vueファイル）の読み方', depth: 0, pageNumber: 15 },
  { id: 'b', title: '04 ref / reactive / computed', depth: 0, pageNumber: 21 },
]

const now = new Date('2026-09-15T01:02:03.000Z')

describe('pdfProgressEntry', () => {
  it('読んでいる位置と、目次の見出し付きのページを記録し、章の数は持たない', () => {
    const position = { sectionId: 'page-23', sectionOffset: 0.4, scrollRatio: 0.2 }

    expect(pdfProgressEntry('アプリ開発/Vue3基礎教科書.pdf', position, outline, undefined, now)).toEqual({
      path: 'アプリ開発/Vue3基礎教科書.pdf',
      lastOpenedAt: '2026-09-15T01:02:03.000Z',
      position,
      sectionTitle: '04 ref / reactive / computed ・ p.23',
      readSectionIds: [],
      sectionCount: 0,
    })
  })

  it('目次の無い PDF は、ページ番号だけを記録する', () => {
    const position = { sectionId: 'page-3', sectionOffset: 0, scrollRatio: 0.1 }

    expect(pdfProgressEntry('QIRA.pdf', position, [], undefined, now).sectionTitle).toBe('p.3')
  })

  it('前の記録に残っている既読は消さない', () => {
    const previous = { readSectionIds: ['old'] } as DocumentProgress
    const position = { sectionId: 'page-1', sectionOffset: 0, scrollRatio: 0 }

    expect(pdfProgressEntry('a.pdf', position, [], previous, now).readSectionIds).toEqual(['old'])
  })
})
