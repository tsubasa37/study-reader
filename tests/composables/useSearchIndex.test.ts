// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentEntry } from '../../shared/types'
import { clearSearchIndex, useSearchIndex } from '../../src/composables/useSearchIndex'
import { api } from '../../src/lib/api'

vi.mock('../../src/lib/api', () => ({ api: { documentHtml: vi.fn() } }))

const documentHtml = vi.mocked(api.documentHtml)

const entry = (path: string, modifiedAt = '2026-09-12T00:00:00.000Z'): DocumentEntry => ({
  path,
  name: path.replace(/\.html$/, ''),
  folder: '',
  size: 100,
  modifiedAt,
})

beforeEach(() => {
  clearSearchIndex()
  documentHtml.mockReset()
  documentHtml.mockResolvedValue('<section id="a"><h2>1章</h2><p>本文です</p></section>')
})

afterEach(() => clearSearchIndex())

describe('useSearchIndex', () => {
  it('同時に頼まれても、同じ資料は1回しか読み込まない', async () => {
    const { ensureIndex } = useSearchIndex()
    const documents = [entry('a.html'), entry('b.html')]

    await Promise.all([ensureIndex(documents), ensureIndex(documents)])

    expect(documentHtml).toHaveBeenCalledTimes(2)
  })

  it('2回目は読み込み直さない', async () => {
    const { ensureIndex, indexed } = useSearchIndex()

    await ensureIndex([entry('a.html')])
    await ensureIndex([entry('a.html')])

    expect(documentHtml).toHaveBeenCalledTimes(1)
    expect(indexed.value.map((document) => document.path)).toEqual(['a.html'])
  })

  it('教材が更新されていれば読み込み直す', async () => {
    const { ensureIndex } = useSearchIndex()

    await ensureIndex([entry('a.html', '2026-09-12T00:00:00.000Z')])
    await ensureIndex([entry('a.html', '2026-09-13T00:00:00.000Z')])

    expect(documentHtml).toHaveBeenCalledTimes(2)
  })

  it('1冊が失敗しても、読めた資料は検索できる', async () => {
    const { ensureIndex, indexed } = useSearchIndex()
    documentHtml.mockImplementation((path: string) =>
      path === 'ng.html' ? Promise.reject(new Error('読めません')) : Promise.resolve('<section id="a"><h2>1章</h2></section>'),
    )

    await expect(ensureIndex([entry('ok.html'), entry('ng.html')])).rejects.toThrow('読めません')

    expect(indexed.value.map((document) => document.path)).toEqual(['ok.html'])
  })

  it('失敗した資料は次に頼まれたとき読み直す', async () => {
    const { ensureIndex } = useSearchIndex()
    documentHtml.mockRejectedValueOnce(new Error('読めません'))

    await expect(ensureIndex([entry('a.html')])).rejects.toThrow('読めません')
    await ensureIndex([entry('a.html')])

    expect(documentHtml).toHaveBeenCalledTimes(2)
  })

  it('資料フォルダから消えた教材は検索の対象から外す', async () => {
    const { ensureIndex, indexed } = useSearchIndex()

    await ensureIndex([entry('a.html'), entry('b.html')])
    await ensureIndex([entry('a.html')])

    expect(indexed.value.map((document) => document.path)).toEqual(['a.html'])
  })
})
