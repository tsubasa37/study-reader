import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../server/app'
import { DEFAULT_HIGHLIGHT_COLOR_NAMES } from '../../shared/constants'
import { createTempVault, type TempVault } from './helpers'

let vault: TempVault
let app: Hono

beforeEach(async () => {
  vault = await createTempVault({ 'TypeScript基礎教科書.html': '<p>ts</p>' })
  app = createApp({ vaultDir: vault.dir, clientDir: null })
})

afterEach(() => vault.cleanup())

function send(method: string, body?: unknown): Promise<Response> {
  return Promise.resolve(
    app.request('/api/settings', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
}

const names = { yellow: '重要', green: '理解した', pink: '質問', blue: '調べる' }

describe('/api/settings', () => {
  it('まだ保存していなければ、色の名前の初期値を返す', async () => {
    const response = await send('GET')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ highlightColorNames: DEFAULT_HIGHLIGHT_COLOR_NAMES })
  })

  it('色の名前を保存し、.study/settings.json に残す', async () => {
    const saved = await send('PUT', { highlightColorNames: names })

    expect(saved.status).toBe(200)
    expect(await (await send('GET')).json()).toEqual({ highlightColorNames: names })
    const file: unknown = JSON.parse(await readFile(join(vault.dir, '.study', 'settings.json'), 'utf8'))
    expect(file).toEqual({ version: 1, highlightColorNames: names })
  })

  it('名前の前後の空白を除いて保存する', async () => {
    const saved = await send('PUT', { highlightColorNames: { ...names, yellow: '  重要 ' } })

    expect(await saved.json()).toEqual({ highlightColorNames: names })
  })

  it('空の名前・足りない色・長すぎる名前は受け付けず、保存済みの名前を変えない', async () => {
    const invalid = [
      { ...names, pink: '   ' },
      { yellow: '重要', green: '理解した', pink: '質問' },
      { ...names, blue: 'あ'.repeat(21) },
    ]

    for (const highlightColorNames of invalid) {
      expect((await send('PUT', { highlightColorNames })).status).toBe(400)
    }
    expect(await (await send('GET')).json()).toEqual({ highlightColorNames: DEFAULT_HIGHLIGHT_COLOR_NAMES })
  })
})
