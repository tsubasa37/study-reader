// @vitest-environment jsdom
import { ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Bookmark, DocumentEntry, Highlight, HighlightColor } from '../../shared/types'
import { useNoteGroups } from '../../src/composables/useNoteGroups'
import { useStudyStore } from '../../src/composables/useStudyStore'
import { indexDocument, type IndexedDocument } from '../../src/lib/search'
import type { HighlightFilter } from '../../src/types/ui'
import { parseHtml } from '../lib/helpers'

const LARAVEL = 'Laravel.html'
const TS = 'アプリ開発/TypeScript.html'
const VUE = 'アプリ開発/Vue3.html'
const ANSIBLE = 'インフラ/Ansible.html'
const NO_NOTES = 'インフラ/Linux.html'

const document_ = (path: string): DocumentEntry => ({
  path,
  name: (path.split('/').pop() ?? path).replace(/\.html$/, ''),
  folder: '',
  kind: 'html',
  size: 1,
  modifiedAt: '2026-09-12T00:00:00.000Z',
})

const bookmark = (id: string, path: string, createdAt: string): Bookmark => ({
  id,
  path,
  position: { sectionId: 'a', sectionOffset: 0, scrollRatio: 0 },
  sectionTitle: '第1章',
  excerpt: 'しおりの抜き出し',
  memo: '',
  createdAt,
  updatedAt: createdAt,
})

const highlight = (
  id: string,
  path: string,
  exact: string,
  { color = 'yellow', memo = '', createdAt = '2026-09-12T00:00:00.000Z' }: { color?: HighlightColor; memo?: string; createdAt?: string } = {},
): Highlight => ({
  id,
  path,
  sectionId: 'a',
  sectionTitle: '第1章',
  quote: { exact, prefix: '', suffix: '', start: 0 },
  color,
  memo,
  createdAt,
  updatedAt: createdAt,
})

const indexedOf = (path: string, body: string): IndexedDocument =>
  indexDocument(path, path, parseHtml(`<section id="a"><h2>第1章</h2><p>${body}</p></section>`))

const filter = (overrides: Partial<HighlightFilter> = {}) =>
  ref<HighlightFilter>({ place: { kind: 'all' }, color: null, text: '', ...overrides })

const idsOf = (groups: { entries: { id: string }[] }[]) => groups.flatMap((group) => group.entries.map((entry) => entry.id))

beforeEach(() => {
  const store = useStudyStore()
  store.state.loaded = true
  // 資料フォルダの読み取り順（フォルダ外の資料が先に来る）
  store.state.documents = [LARAVEL, TS, VUE, ANSIBLE, NO_NOTES].map(document_)
  store.state.progress = {}
  store.state.bookmarks = [
    bookmark('b1', LARAVEL, '2026-09-11T00:00:00.000Z'),
    bookmark('b2', VUE, '2026-09-12T00:00:00.000Z'),
  ]
  store.state.highlights = [
    highlight('h1', TS, '外部データの検証', { createdAt: '2026-09-12T00:00:00.000Z' }),
    highlight('h2', TS, '絞り込みの型', { color: 'pink', memo: '早期 return', createdAt: '2026-09-13T00:00:00.000Z' }),
    highlight('h3', VUE, 'computed の再計算', { color: 'green' }),
    highlight('h4', ANSIBLE, 'sudo で権限を借りる', { color: 'blue' }),
    highlight('h5', LARAVEL, '迷ったときの判断フロー'),
  ]
})

describe('useNoteGroups', () => {
  it('ハイライトを本棚と同じ並び（プロジェクト順、フォルダ外は最後）で資料ごとにまとめ、新しい順に並べる', () => {
    const { groups, total } = useNoteGroups(filter(), ref([]))

    expect(groups.value.map((group) => [group.path, group.project, group.entries.map((entry) => entry.id)])).toEqual([
      [TS, 'アプリ開発', ['h2', 'h1']],
      [VUE, 'アプリ開発', ['h3']],
      [ANSIBLE, 'インフラ', ['h4']],
      [LARAVEL, '', ['h5']],
    ])
    expect(total.value).toBe(5)
  })

  it('しおりは資料名を添え、新しい順に返す', () => {
    const { bookmarks } = useNoteGroups(filter(), ref([]))

    expect(bookmarks.value.map((entry) => [entry.id, entry.name])).toEqual([
      ['b2', 'Vue3'],
      ['b1', 'Laravel'],
    ])
  })

  it('タブの件数は、絞り込みに関係なく全件を数える', () => {
    const { counts } = useNoteGroups(filter({ color: 'pink', text: '存在しない言葉' }), ref([]))

    expect(counts.value).toEqual({ highlight: 5, bookmark: 2 })
  })

  it('資料の木は、ハイライトのある資料だけをプロジェクトごとにまとめる', () => {
    const { tree } = useNoteGroups(filter(), ref([]))

    expect(tree.value).toEqual({
      count: 5,
      projects: [
        {
          folder: 'アプリ開発',
          count: 3,
          documents: [
            { path: TS, name: 'TypeScript', count: 2 },
            { path: VUE, name: 'Vue3', count: 1 },
          ],
        },
        { folder: 'インフラ', count: 1, documents: [{ path: ANSIBLE, name: 'Ansible', count: 1 }] },
      ],
      loose: [{ path: LARAVEL, name: 'Laravel', count: 1 }],
    })
  })

  it('木の件数は色と文字の絞り込みを反映し、資料の絞り込みには左右されない', () => {
    const { tree } = useNoteGroups(filter({ place: { kind: 'document', path: VUE }, color: 'yellow' }), ref([]))

    expect(tree.value?.count).toBe(2)
    expect(tree.value?.projects[0]?.documents.map((document) => document.count)).toEqual([1, 0])
    expect(tree.value?.loose[0]?.count).toBe(1)
  })

  it('ハイライトのある資料が1つだけなら木を出さず、資料での絞り込みもしない', () => {
    const store = useStudyStore()
    store.state.highlights = [highlight('h1', TS, '外部データの検証'), highlight('h2', TS, '絞り込みの型')]

    const { tree, total } = useNoteGroups(filter({ place: { kind: 'document', path: VUE } }), ref([]))

    expect(tree.value).toBeNull()
    expect(total.value).toBe(2)
  })

  it('プロジェクト・資料・色・文字で絞り込み、掛け合わせられる', () => {
    const project = { kind: 'project', folder: 'アプリ開発' } as const

    expect(idsOf(useNoteGroups(filter({ place: project }), ref([])).groups.value)).toEqual(['h2', 'h1', 'h3'])
    expect(idsOf(useNoteGroups(filter({ place: { kind: 'document', path: LARAVEL } }), ref([])).groups.value)).toEqual(['h5'])
    expect(idsOf(useNoteGroups(filter({ color: 'yellow' }), ref([])).groups.value)).toEqual(['h1', 'h5'])
    expect(idsOf(useNoteGroups(filter({ text: '早期' }), ref([])).groups.value)).toEqual(['h2'])
    expect(idsOf(useNoteGroups(filter({ place: project, color: 'yellow' }), ref([])).groups.value)).toEqual(['h1'])
  })

  it('色ごとの件数は資料と文字の絞り込みを反映し、色の絞り込みには左右されない', () => {
    const { colorCounts } = useNoteGroups(
      filter({ place: { kind: 'project', folder: 'アプリ開発' }, color: 'blue' }),
      ref([]),
    )

    expect(colorCounts.value).toEqual({ all: 3, yellow: 1, green: 1, pink: 1, blue: 0 })
  })

  it('本文に見つからないハイライトに「見失った」印を付ける', () => {
    const indexed = ref([indexedOf(TS, '書き換えた後の本文です')])

    const { groups } = useNoteGroups(filter({ place: { kind: 'document', path: TS } }), indexed)

    expect(groups.value[0]?.entries.map((entry) => [entry.id, entry.lost])).toEqual([
      ['h2', true],
      ['h1', true],
    ])
  })

  it('本文がまだ読み込めていない資料は「見失った」にしない', () => {
    const { groups } = useNoteGroups(filter({ place: { kind: 'document', path: TS } }), ref([]))

    expect(groups.value[0]?.entries.every((entry) => !entry.lost)).toBe(true)
  })

  it('本文に残っているハイライトは印を付けない', () => {
    const indexed = ref([indexedOf(TS, 'ここに外部データの検証と絞り込みの型があります')])

    const { groups } = useNoteGroups(filter({ place: { kind: 'document', path: TS } }), indexed)

    expect(groups.value[0]?.entries.every((entry) => !entry.lost)).toBe(true)
  })
})
