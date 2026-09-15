import { describe, expect, it } from 'vitest'
import { flattenOutline, pageList, pdfPlaceLabel, tocEntryAt, type OutlineNode, type PdfTocEntry } from '../../src/lib/pdfOutline'

const node = (title: string, dest: OutlineNode['dest'], items: OutlineNode[] = []): OutlineNode => ({ title, dest, items })

// 名前付きの飛び先はページ番号の表で、配列の飛び先は先頭の値をページ番号として解決する
const resolver = async (dest: string | readonly unknown[]) =>
  typeof dest === 'string' ? ({ ch1: 6, ch2: 10 } as Record<string, number>)[dest] ?? null : (dest[0] as number)

describe('flattenOutline', () => {
  it('入れ子の目次を文書順に平らに並べ、深さと飛び先のページ番号を添える', async () => {
    const entries = await flattenOutline(
      [node('01  Vueを学ぶための地図', 'ch1', [node('地図の見方', [8])]), node('02 学習環境', 'ch2'), node('サイト', null)],
      resolver,
    )

    expect(entries).toEqual([
      { id: 'outline-0', title: '01 Vueを学ぶための地図', depth: 0, pageNumber: 6 },
      { id: 'outline-1', title: '地図の見方', depth: 1, pageNumber: 8 },
      { id: 'outline-2', title: '02 学習環境', depth: 0, pageNumber: 10 },
      { id: 'outline-3', title: 'サイト', depth: 0, pageNumber: null },
    ])
  })

  it('見出しが空の項目は「（無題）」にする', async () => {
    const [entry] = await flattenOutline([node('  ', [1])], resolver)

    expect(entry?.title).toBe('（無題）')
  })

  it('飛び先を解決できずに失敗したら、その失敗をそのまま返す', async () => {
    const broken = async () => {
      throw new Error('飛び先が壊れています')
    }

    await expect(flattenOutline([node('01', 'ch1')], broken)).rejects.toThrow('飛び先が壊れています')
  })
})

describe('tocEntryAt', () => {
  const entries: PdfTocEntry[] = [
    { id: 'a', title: '01', depth: 0, pageNumber: 6 },
    { id: 'b', title: '01-1', depth: 1, pageNumber: 8 },
    { id: 'c', title: 'リンク', depth: 0, pageNumber: null },
    { id: 'd', title: '02', depth: 0, pageNumber: 10 },
  ]

  it('今のページ以前から始まる項目のうち、文書順で最後のものを返す', () => {
    expect(tocEntryAt(entries, 9)?.id).toBe('b')
    expect(tocEntryAt(entries, 10)?.id).toBe('d')
  })

  it('最初の項目より前のページなら null', () => {
    expect(tocEntryAt(entries, 5)).toBeNull()
  })
})

describe('pageList', () => {
  it('ページ番号の一覧を目次の代わりに作る', () => {
    expect(pageList(2)).toEqual([
      { id: 'page-1', title: 'p.1', depth: 0, pageNumber: 1 },
      { id: 'page-2', title: 'p.2', depth: 0, pageNumber: 2 },
    ])
  })
})

describe('pdfPlaceLabel', () => {
  it('目次の見出しがあれば、見出しとページ番号を並べる', () => {
    expect(pdfPlaceLabel({ id: 'a', title: '04 ref / reactive / computed', depth: 0, pageNumber: 21 }, 23)).toBe(
      '04 ref / reactive / computed ・ p.23',
    )
  })

  it('見出しが無いか、ページ番号の一覧のときはページ番号だけ', () => {
    expect(pdfPlaceLabel(null, 3)).toBe('p.3')
    expect(pdfPlaceLabel(pageList(3)[2] ?? null, 3)).toBe('p.3')
  })
})
