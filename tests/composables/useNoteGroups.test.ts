// @vitest-environment jsdom
import { ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Bookmark, DocumentEntry, Highlight } from '../../shared/types'
import { useNoteGroups, type NoteFilter } from '../../src/composables/useNoteGroups'
import { useStudyStore } from '../../src/composables/useStudyStore'
import { indexDocument, type IndexedDocument } from '../../src/lib/search'
import { parseHtml } from '../lib/helpers'

const document_ = (path: string): DocumentEntry => ({
  path,
  name: path.replace(/\.html$/, ''),
  folder: '',
  size: 1,
  modifiedAt: '2026-09-12T00:00:00.000Z',
})

const bookmark = (id: string, path: string, memo = ''): Bookmark => ({
  id,
  path,
  position: { sectionId: 'a', sectionOffset: 0, scrollRatio: 0 },
  sectionTitle: '第1章',
  excerpt: 'しおりの抜き出し',
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
  color: 'yellow',
  memo,
  createdAt: '2026-09-12T00:00:00.000Z',
  updatedAt: '2026-09-12T00:00:00.000Z',
})

const indexedOf = (path: string, body: string): IndexedDocument =>
  indexDocument(path, path, parseHtml(`<section id="a"><h2>第1章</h2><p>${body}</p></section>`))

const filter = (overrides: Partial<NoteFilter> = {}) =>
  ref<NoteFilter>({ kind: 'all', path: '', text: '', ...overrides })

beforeEach(() => {
  const store = useStudyStore()
  store.state.loaded = true
  store.state.documents = [document_('a.html'), document_('b.html')]
  store.state.progress = {}
  store.state.bookmarks = [bookmark('b1', 'a.html', 'あとで復習')]
  store.state.highlights = [highlight('h1', 'a.html', '大事な文章'), highlight('h2', 'b.html', '別の教材の文章')]
})

describe('useNoteGroups', () => {
  it('資料ごとにまとめ、資料フォルダの並び順で返す', () => {
    const { groups, total } = useNoteGroups(filter(), ref([]))

    expect(groups.value.map((group) => [group.path, group.entries.length])).toEqual([
      ['a.html', 2],
      ['b.html', 1],
    ])
    expect(total.value).toBe(3)
  })

  it('ハイライトを先に、新しい順に並べる', () => {
    const { groups } = useNoteGroups(filter({ path: 'a.html' }), ref([]))

    expect(groups.value[0]?.entries.map((entry) => entry.id)).toEqual(['h1', 'b1'])
  })

  it('本文に見つからないハイライトに「見失った」印を付ける', () => {
    const indexed = ref([indexedOf('a.html', '書き換えた後の本文です')])

    const { groups } = useNoteGroups(filter({ path: 'a.html', kind: 'highlight' }), indexed)

    expect(groups.value[0]?.entries[0]).toMatchObject({ id: 'h1', lost: true })
  })

  it('本文がまだ読み込めていない資料は「見失った」にしない', () => {
    const { groups } = useNoteGroups(filter({ path: 'a.html', kind: 'highlight' }), ref([]))

    expect(groups.value[0]?.entries[0]?.lost).toBe(false)
  })

  it('本文に残っているハイライトは印を付けない', () => {
    const indexed = ref([indexedOf('a.html', 'ここに大事な文章があります')])

    const { groups } = useNoteGroups(filter({ path: 'a.html', kind: 'highlight' }), indexed)

    expect(groups.value[0]?.entries[0]?.lost).toBe(false)
  })

  it('種類・資料・文字で絞り込む', () => {
    expect(useNoteGroups(filter({ kind: 'bookmark' }), ref([])).total.value).toBe(1)
    expect(useNoteGroups(filter({ path: 'b.html' }), ref([])).total.value).toBe(1)
    expect(useNoteGroups(filter({ text: 'あとで' }), ref([])).total.value).toBe(1)
  })

})
