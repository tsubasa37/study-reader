import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../server/app'
import type { DocumentList, DocumentProgress, NewBookmark, NewHighlight, StudyState } from '../../shared/types'
import { createTempVault, type TempVault } from './helpers'

const DOC = 'TypeScript基礎教科書.html'
const NESTED = 'infra/Ansible・CI基礎教科書.html'

let vault: TempVault
let app: Hono

beforeEach(async () => {
  vault = await createTempVault({
    [DOC]: '<!doctype html><title>TS</title><section id="t-start"><h2>01</h2></section>',
    [NESTED]: '<p>ansible</p>',
    'TypeScript基礎教科書.pdf': 'pdf',
  })
  app = createApp({ vaultDir: vault.dir, clientDir: null })
})

afterEach(() => vault.cleanup())

function send(method: string, path: string, body?: unknown): Promise<Response> {
  return Promise.resolve(
    app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

async function state(): Promise<StudyState> {
  return (await (await send('GET', '/api/state')).json()) as StudyState
}

function progress(overrides: Partial<DocumentProgress> = {}): DocumentProgress {
  return {
    path: DOC,
    lastOpenedAt: '2026-09-11T04:06:00.000Z',
    position: { sectionId: 't-start', sectionOffset: 0.5, scrollRatio: 0.2 },
    sectionTitle: '01',
    readSectionIds: ['t-start'],
    sectionCount: 1,
    ...overrides,
  }
}

const bookmark = (path = DOC): NewBookmark => ({
  path,
  position: { sectionId: 't-start', sectionOffset: 0.1, scrollRatio: 0.05 },
  sectionTitle: '01',
  excerpt: '型で、データと処理を説明する',
  memo: '',
})

const highlight = (path = DOC): NewHighlight => ({
  path,
  sectionId: 't-start',
  sectionTitle: '01',
  quote: { exact: '型', prefix: '', suffix: 'で', start: 0 },
  color: 'yellow',
  memo: '',
})

describe('資料', () => {
  it('資料フォルダの名前と HTML の一覧を返す', async () => {
    const body = (await (await send('GET', '/api/documents')).json()) as DocumentList

    expect(body.vaultName).toBe(vault.dir.split('/').pop())
    expect(body.documents.map((document) => document.path)).toEqual([NESTED, DOC])
  })

  it('日本語名の HTML を text/html で返す', async () => {
    const response = await send('GET', `/vault/${encodeURIComponent(DOC)}`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(await response.text()).toContain('t-start')
  })

  it('入れ子のフォルダの資料を返す', async () => {
    const response = await send('GET', `/vault/infra/${encodeURIComponent('Ansible・CI基礎教科書.html')}`)

    expect(response.status).toBe(200)
  })

  it.each(['/vault/..%2F..%2Fetc%2Fpasswd', '/vault/.study/progress.json'])('%s は 400', async (path) => {
    expect((await send('GET', path)).status).toBe(400)
  })

  it('無いファイルは 404', async () => {
    expect((await send('GET', `/vault/${encodeURIComponent('無い.html')}`)).status).toBe(404)
  })
})

describe('進み具合', () => {
  it('保存した進み具合を state で読める', async () => {
    const response = await send('PUT', '/api/progress', progress())

    expect(response.status).toBe(200)
    expect((await state()).progress[DOC]).toEqual(progress())
  })

  it('形が違えば 400 で理由を返す', async () => {
    const response = await send('PUT', '/api/progress', { path: DOC })

    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: string }).error).toContain('正しくありません')
  })

  it('JSON として読めなければ 400', async () => {
    const response = await app.request('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })

    expect(response.status).toBe(400)
  })
})

describe('しおり', () => {
  it('追加・メモの変更・削除ができる', async () => {
    const created = await send('POST', '/api/bookmarks', bookmark())
    expect(created.status).toBe(201)
    const { id } = (await created.json()) as { id: string }

    const updated = await send('PATCH', `/api/bookmarks/${id}`, { memo: 'ここから復習' })
    expect(((await updated.json()) as { memo: string }).memo).toBe('ここから復習')

    expect((await send('DELETE', `/api/bookmarks/${id}`)).status).toBe(204)
    expect((await state()).bookmarks).toEqual([])
  })

  it('無いしおりは 404', async () => {
    expect((await send('PATCH', '/api/bookmarks/nope', { memo: 'x' })).status).toBe(404)
    expect((await send('DELETE', '/api/bookmarks/nope')).status).toBe(404)
  })
})

describe('ハイライト', () => {
  it('追加して色とメモを変えられる', async () => {
    const created = await send('POST', '/api/highlights', highlight())
    const { id } = (await created.json()) as { id: string }

    await send('PATCH', `/api/highlights/${id}`, { color: 'blue', memo: 'never になる' })

    expect((await state()).highlights[0]).toMatchObject({ id, color: 'blue', memo: 'never になる' })
  })

  it('変える項目が無ければ 400', async () => {
    const { id } = (await (await send('POST', '/api/highlights', highlight())).json()) as { id: string }

    expect((await send('PATCH', `/api/highlights/${id}`, {})).status).toBe(400)
  })

  it('用意していない色は 400', async () => {
    expect((await send('POST', '/api/highlights', { ...highlight(), color: 'red' })).status).toBe(400)
  })
})

describe('記録の引き継ぎ', () => {
  it('無くなったファイルの記録を、別の資料へまとめて移す', async () => {
    await send('PUT', '/api/progress', progress({ path: 'old.html' }))
    await send('POST', '/api/bookmarks', bookmark('old.html'))
    await send('POST', '/api/highlights', highlight('old.html'))

    const response = await send('POST', '/api/records/move', { from: 'old.html', to: DOC })

    expect(await response.json()).toEqual({ progress: 1, bookmarks: 1, highlights: 1 })
    const current = await state()
    expect(current.progress['old.html']).toBeUndefined()
    expect(current.progress[DOC]?.path).toBe(DOC)
    expect(current.bookmarks[0]?.path).toBe(DOC)
    expect(current.highlights[0]?.path).toBe(DOC)
  })

  it('引き継ぎ先にも進み具合があれば、新しい方の位置を残し既読の章を合わせる', async () => {
    await send(
      'PUT',
      '/api/progress',
      progress({
        path: 'old.html',
        lastOpenedAt: '2026-09-10T00:00:00.000Z',
        readSectionIds: ['a'],
        position: { sectionId: 'a', sectionOffset: 0, scrollRatio: 0 },
      }),
    )
    await send(
      'PUT',
      '/api/progress',
      progress({ readSectionIds: ['b'], position: { sectionId: 'b', sectionOffset: 0, scrollRatio: 0.5 } }),
    )

    await send('POST', '/api/records/move', { from: 'old.html', to: DOC })

    const merged = (await state()).progress[DOC]
    expect(merged?.position.sectionId).toBe('b')
    expect([...(merged?.readSectionIds ?? [])].sort()).toEqual(['a', 'b'])
  })

  it('引き継ぎ先の資料が無ければ 400', async () => {
    await send('PUT', '/api/progress', progress({ path: 'old.html' }))

    expect((await send('POST', '/api/records/move', { from: 'old.html', to: 'missing.html' })).status).toBe(400)
  })

  it('引き継ぐ記録が無ければ 404', async () => {
    expect((await send('POST', '/api/records/move', { from: 'old.html', to: DOC })).status).toBe(404)
  })

  it('記録を削除できる', async () => {
    await send('PUT', '/api/progress', progress({ path: 'old.html' }))
    await send('POST', '/api/bookmarks', bookmark('old.html'))

    const response = await send('DELETE', `/api/records?path=${encodeURIComponent('old.html')}`)

    expect(await response.json()).toEqual({ progress: 1, bookmarks: 1, highlights: 0 })
    expect(await state()).toEqual({ progress: {}, bookmarks: [], highlights: [] })
  })
})

describe('資料の移動', () => {
  const moveTo = (folder: string, path = DOC) => send('POST', '/api/documents/move', { path, folder })

  it('プロジェクトへ移し、同じ名前の PDF と記録も一緒に動かす', async () => {
    await send('PUT', '/api/progress', progress())
    await send('POST', '/api/bookmarks', bookmark())

    const response = await moveTo('アプリ開発')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      path: 'アプリ開発/TypeScript基礎教科書.html',
      movedFiles: ['アプリ開発/TypeScript基礎教科書.html', 'アプリ開発/TypeScript基礎教科書.pdf'],
      records: { progress: 1, bookmarks: 1, highlights: 0 },
    })
    expect(await readdir(join(vault.dir, 'アプリ開発'))).toEqual([
      'TypeScript基礎教科書.html',
      'TypeScript基礎教科書.pdf',
    ])
    const current = await state()
    expect(current.progress[DOC]).toBeUndefined()
    expect(current.progress['アプリ開発/TypeScript基礎教科書.html']?.path).toBe('アプリ開発/TypeScript基礎教科書.html')
    expect(current.bookmarks[0]?.path).toBe('アプリ開発/TypeScript基礎教科書.html')
  })

  it('記録がまだ無い資料でも移せる', async () => {
    const response = await moveTo('アプリ開発')

    expect(response.status).toBe(200)
    expect(((await response.json()) as { records: unknown }).records).toEqual({
      progress: 0,
      bookmarks: 0,
      highlights: 0,
    })
  })

  it('プロジェクトから出せる', async () => {
    const response = await moveTo('', NESTED)

    expect(((await response.json()) as { path: string }).path).toBe('Ansible・CI基礎教科書.html')
  })

  it('移動先に同じ名前のファイルがあれば、1つも動かさない', async () => {
    // infra にも同じファイル名の資料を置き、資料フォルダ直下へ移そうとしてぶつける
    await writeFile(join(vault.dir, 'infra', DOC), '<p>同じ名前の別ファイル</p>', 'utf8')

    const conflict = await send('POST', '/api/documents/move', { path: `infra/${DOC}`, folder: '' })

    expect(conflict.status).toBe(409)
    expect(((await conflict.json()) as { error: string }).error).toContain('同じ名前')
    expect(await readdir(join(vault.dir, 'infra'))).toContain(DOC)
  })

  it.each(['../外', '.隠し', 'ある/深い'])('使えないプロジェクト名 %s は 400', async (folder) => {
    expect((await moveTo(folder)).status).toBe(400)
  })

  it('無い資料は 404', async () => {
    expect((await moveTo('アプリ開発', '無い.html')).status).toBe(404)
  })

  it('すでに同じ場所にあるなら 400', async () => {
    expect((await moveTo('')).status).toBe(400)
  })
})
