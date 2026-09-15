import { describe, expect, it } from 'vitest'
import { documentKindOf } from '../../shared/documentKind'

describe('documentKindOf', () => {
  it.each([
    ['教材.html', 'html'],
    ['教材.HTM', 'html'],
    ['アプリ開発/Vue3基礎教科書.pdf', 'pdf'],
    ['資料.PDF', 'pdf'],
  ])('%s は %s', (fileName, kind) => {
    expect(documentKindOf(fileName)).toBe(kind)
  })

  it.each(['メモ.txt', '拡張子なし', '.pdf', 'フォルダ.pdf/中身', 'v1.2/教材'])('%s は資料として扱わない', (fileName) => {
    expect(documentKindOf(fileName)).toBeNull()
  })
})
