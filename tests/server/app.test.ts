import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

// 消えた資料の記録は API からは作れないので、記録ファイルを直接置いて用意する
async function seedRecords(
  path: string,
  options: { progress?: Partial<DocumentProgress>; bookmarks?: number; highlights?: number } = {},
): Promise<void> {
  const dir = join(vault.dir, '.study')
  await mkdir(dir, { recursive: true })
  const current = await state()
  const at = '2026-09-11T04:06:00.000Z'
  const documents = { ...current.progress, [path]: progress({ path, ...options.progress }) }
  await writeFile(join(dir, 'progress.json'), JSON.stringify({ version: 1, documents }, null, 2), 'utf8')
  if (options.bookmarks !== undefined) {
    const items = Array.from({ length: options.bookmarks }, (_, index) => ({
      ...bookmark(path),
      id: `seed-bookmark-${index}`,
      createdAt: at,
      updatedAt: at,
    }))
    await writeFile(join(dir, 'bookmarks.json'), JSON.stringify({ version: 1, items }, null, 2), 'utf8')
  }
  if (options.highlights !== undefined) {
    const items = Array.from({ length: options.highlights }, (_, index) => ({
      ...highlight(path),
      id: `seed-highlight-${index}`,
      createdAt: at,
      updatedAt: at,
    }))
    await writeFile(join(dir, 'highlights.json'), JSON.stringify({ version: 1, items }, null, 2), 'utf8')
  }
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

describe('記録はフォルダの中身に自動で合わせる', () => {
  it('Finder で資料を移しても、記録が自動で追いつく', async () => {
    await send('PUT', '/api/progress', progress())
    await send('POST', '/api/bookmarks', bookmark())
    await mkdir(join(vault.dir, 'アプリ開発'), { recursive: true })
    await rename(join(vault.dir, DOC), join(vault.dir, 'アプリ開発', DOC))

    const current = await state()

    expect(current.progress[DOC]).toBeUndefined()
    expect(current.progress[`アプリ開発/${DOC}`]?.readSectionIds).toEqual(['t-start'])
    expect(current.bookmarks[0]?.path).toBe(`アプリ開発/${DOC}`)
  })

  it('資料を消すと記録は画面から消え、しまっておく置き場へ移る', async () => {
    await send('PUT', '/api/progress', progress())
    await rm(join(vault.dir, DOC))

    const current = await state()

    expect(current.progress).toEqual({})
    const archive = JSON.parse(await readFile(join(vault.dir, '.study', 'archive.json'), 'utf8')) as {
      progress: Record<string, unknown>
    }
    expect(archive.progress[DOC]).toBeDefined()
  })

  it('同じ名前で資料が戻ってくると、記録も戻る', async () => {
    await send('PUT', '/api/progress', progress())
    const html = await readFile(join(vault.dir, DOC), 'utf8')
    await rm(join(vault.dir, DOC))
    await state()

    await mkdir(join(vault.dir, '新しいフォルダ'), { recursive: true })
    await writeFile(join(vault.dir, '新しいフォルダ', DOC), html, 'utf8')
    const current = await state()

    expect(current.progress[`新しいフォルダ/${DOC}`]?.readSectionIds).toEqual(['t-start'])
  })

  it('同じ名前の資料が複数あるときは勝手に結び付けない', async () => {
    await seedRecords('どこか/教材.html', { bookmarks: 1 })
    await mkdir(join(vault.dir, 'A'), { recursive: true })
    await mkdir(join(vault.dir, 'B'), { recursive: true })
    await writeFile(join(vault.dir, 'A', '教材.html'), '<p>A</p>', 'utf8')
    await writeFile(join(vault.dir, 'B', '教材.html'), '<p>B</p>', 'utf8')

    const current = await state()

    expect(current.progress['A/教材.html']).toBeUndefined()
    expect(current.progress['B/教材.html']).toBeUndefined()
    expect(current.bookmarks).toEqual([])
  })

  it('同じ名前の別の資料にすでに記録があれば、混ぜずにしまっておく', async () => {
    for (const folder of ['A', 'B']) {
      await mkdir(join(vault.dir, folder), { recursive: true })
      await writeFile(join(vault.dir, folder, '教材.html'), `<p>${folder}</p>`, 'utf8')
    }
    await send('PUT', '/api/progress', progress({ path: 'A/教材.html', readSectionIds: ['a1', 'a2'] }))
    await send('PUT', '/api/progress', progress({ path: 'B/教材.html', readSectionIds: ['b1'] }))
    await send('POST', '/api/highlights', { ...highlight('A/教材.html'), memo: 'Aのメモ' })
    await rm(join(vault.dir, 'A', '教材.html'))

    await state()
    const current = await state()

    expect(current.progress['B/教材.html']?.readSectionIds).toEqual(['b1'])
    expect(current.highlights).toEqual([])
    const archive = JSON.parse(await readFile(join(vault.dir, '.study', 'archive.json'), 'utf8')) as {
      progress: Record<string, unknown>
      highlights: { memo: string }[]
    }
    expect(archive.progress['A/教材.html']).toBeDefined()
    expect(archive.highlights.map((item) => item.memo)).toEqual(['Aのメモ'])
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

describe('入口の門（外部サイトからの操作を断つ）', () => {
  it('別のドメインを装った呼び出しは 403', async () => {
    expect((await app.request('http://evil.example/api/state')).status).toBe(403)
  })

  it('外部サイトからの取得（Sec-Fetch-Site: cross-site）は 403', async () => {
    const response = await app.request('/api/state', { headers: { 'Sec-Fetch-Site': 'cross-site' } })

    expect(response.status).toBe(403)
  })

  it('外部サイトの Origin は 403', async () => {
    const response = await app.request('/api/state', { headers: { Origin: 'https://evil.example' } })

    expect(response.status).toBe(403)
  })

  it('text/plain で送られた書き込みは 415（事前確認を迂回させない）', async () => {
    const response = await app.request('/api/documents/move', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ path: DOC, folder: 'アプリ開発' }),
    })

    expect(response.status).toBe(415)
    expect(await readdir(vault.dir)).toContain(DOC)
  })

  it('自分の画面からの操作（same-origin）は通る', async () => {
    const response = await app.request('/api/state', {
      headers: { 'Sec-Fetch-Site': 'same-origin', Origin: 'http://localhost' },
    })

    expect(response.status).toBe(200)
  })

  it('大きすぎる本文は 413', async () => {
    const response = await send('PUT', '/api/progress', {
      ...progress(),
      readSectionIds: Array.from({ length: 5000 }, () => 'x'.repeat(200)),
    })

    expect(response.status).toBe(413)
  })

  it('章の数が多すぎる記録は 400', async () => {
    const response = await send('PUT', '/api/progress', {
      ...progress(),
      readSectionIds: Array.from({ length: 5001 }, (_, index) => `ch${index}`),
    })

    expect(response.status).toBe(400)
  })
})

describe('シンボリックリンク（資料フォルダの外へ出さない）', () => {
  let outside: string

  beforeEach(async () => {
    outside = await mkdtemp(join(tmpdir(), 'study-reader-outside-'))
    await writeFile(join(outside, 'secret.txt'), 'himitsu', 'utf8')
  })

  afterEach(() => rm(outside, { recursive: true, force: true }))

  it('外を指すリンクは配信しない', async () => {
    await symlink(join(outside, 'secret.txt'), join(vault.dir, 'リンク.html'))

    const response = await send('GET', `/vault/${encodeURIComponent('リンク.html')}`)

    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('himitsu')
  })

  it('移動先が外を指すリンクなら移動しない', async () => {
    await symlink(outside, join(vault.dir, 'そとリンク'))

    const response = await send('POST', '/api/documents/move', { path: DOC, folder: 'そとリンク' })

    expect(response.status).toBe(400)
    expect(await readdir(vault.dir)).toContain(DOC)
    expect(await readdir(outside)).toEqual(['secret.txt'])
  })
})

describe('資料の移動（壊さない）', () => {
  it('移動先に同じ名前のフォルダがあれば 409 で1つも動かさない', async () => {
    await mkdir(join(vault.dir, 'アプリ開発', 'TypeScript基礎教科書.pdf'), { recursive: true })

    const response = await send('POST', '/api/documents/move', { path: DOC, folder: 'アプリ開発' })

    expect(response.status).toBe(409)
    expect(await readdir(vault.dir)).toContain(DOC)
    expect(await readdir(join(vault.dir, 'アプリ開発'))).toEqual(['TypeScript基礎教科書.pdf'])
  })

  it('拡張子の無い同じ名前のファイルは巻き込まない', async () => {
    await writeFile(join(vault.dir, 'TypeScript基礎教科書'), 'メモ', 'utf8')

    const response = await send('POST', '/api/documents/move', { path: DOC, folder: 'アプリ開発' })

    expect(((await response.json()) as { movedFiles: string[] }).movedFiles).toEqual([
      'アプリ開発/TypeScript基礎教科書.html',
      'アプリ開発/TypeScript基礎教科書.pdf',
    ])
    expect(await readdir(vault.dir)).toContain('TypeScript基礎教科書')
  })
})

describe('記録の宛先は実在する資料だけ', () => {
  it('消えた資料への進み具合の保存は 404', async () => {
    expect((await send('PUT', '/api/progress', progress({ path: '消えた.html' }))).status).toBe(404)
  })

  it('消えた資料へのしおり追加は 404', async () => {
    expect((await send('POST', '/api/bookmarks', bookmark('消えた.html'))).status).toBe(404)
  })
})

describe('教材の配信', () => {
  it('教材には CSP と nosniff を付ける', async () => {
    const response = await send('GET', `/vault/${encodeURIComponent(DOC)}`)

    expect(response.headers.get('content-security-policy')).toContain("connect-src 'none'")
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('last-modified')).not.toBeNull()
  })

  it('教材が使う Google Fonts だけは外から読み込める', async () => {
    const response = await send('GET', `/vault/${encodeURIComponent(DOC)}`)
    const directives = new Map(
      (response.headers.get('content-security-policy') ?? '').split(';').map((directive) => {
        const [name = '', ...sources] = directive.trim().split(/\s+/)
        return [name, sources] as const
      }),
    )

    expect(directives.get('style-src')).toContain('https://fonts.googleapis.com')
    expect(directives.get('font-src')).toContain('https://fonts.gstatic.com')
    expect(directives.get('script-src')).toEqual(["'unsafe-inline'"])
    expect(directives.get('connect-src')).toEqual(["'none'"])
  })

  it('更新されていなければ 304 を返す', async () => {
    const first = await send('GET', `/vault/${encodeURIComponent(DOC)}`)
    const lastModified = first.headers.get('last-modified') ?? ''

    const second = await app.request(`/vault/${encodeURIComponent(DOC)}`, {
      headers: { 'If-Modified-Since': lastModified },
    })

    expect(second.status).toBe(304)
    expect(await second.text()).toBe('')
  })
})
