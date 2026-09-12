// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { Bookmark, DocumentEntry, Highlight } from '../../shared/types'
import { findNoteHits } from '../../src/components/search/noteHits'
import { useStudyStore } from '../../src/composables/useStudyStore'

const store = useStudyStore()

const document_ = (path: string): DocumentEntry => ({
  path,
  name: path.replace(/\.html$/, ''),
  folder: '',
  size: 1,
  modifiedAt: '2026-09-12T00:00:00.000Z',
})

const bookmark = (id: string, path: string, memo: string): Bookmark => ({
  id,
  path,
  position: { sectionId: 'a', sectionOffset: 0, scrollRatio: 0 },
  sectionTitle: '第1章',
  excerpt: '本文の抜き出し',
  memo,
  createdAt: '2026-09-11T00:00:00.000Z',
  updatedAt: '2026-09-11T00:00:00.000Z',
})

const highlight = (id: string, path: string, exact: string, memo = ''): Highlight => ({
  id,
  path,
  sectionId: 'a',
  sectionTitle: '第1章',
  quote: { exact, prefix: '', suffix: '', start: 0 },
  color: 'blue',
  memo,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
})

beforeEach(() => {
  store.state.loaded = true
  store.state.documents = [document_('a.html')]
  store.state.bookmarks = [bookmark('b1', 'a.html', 'ここから復習')]
  store.state.highlights = [highlight('h1', 'a.html', '交差型は上書きではない', 'never になる')]
})

describe('findNoteHits', () => {
  it('ハイライトの文章からも、メモからも探せる', () => {
    expect(findNoteHits(store, '交差型').map((hit) => hit.id)).toEqual(['h1'])
    expect(findNoteHits(store, 'never').map((hit) => hit.id)).toEqual(['h1'])
    expect(findNoteHits(store, '復習').map((hit) => hit.id)).toEqual(['b1'])
  })

  it('資料名を添える', () => {
    expect(findNoteHits(store, '交差型')[0]?.name).toBe('a')
  })

  it('資料フォルダに無い資料のしおりは出さない', () => {
    store.state.bookmarks = [...store.state.bookmarks, bookmark('b2', '消えた.html', 'ここから復習')]

    expect(findNoteHits(store, '復習').map((hit) => hit.id)).toEqual(['b1'])
  })

  it('空の検索語では何も返さない', () => {
    expect(findNoteHits(store, '   ')).toEqual([])
  })

  it('多すぎるときは 20 件で打ち切る', () => {
    store.state.highlights = Array.from({ length: 30 }, (_, index) =>
      highlight(`h${index}`, 'a.html', `交差型のメモ${index}`),
    )

    expect(findNoteHits(store, '交差型')).toHaveLength(20)
  })
})
