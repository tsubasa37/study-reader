import { readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { JsonStore } from '../../server/store'
import { createTempVault, type TempVault } from './helpers'

const Schema = z.object({ version: z.literal(1), items: z.array(z.number()) })
type Data = z.infer<typeof Schema>

let vault: TempVault
let file: string
let store: JsonStore<Data>

beforeEach(async () => {
  vault = await createTempVault({})
  file = join(vault.dir, '.study', 'numbers.json')
  store = new JsonStore(file, Schema, () => ({ version: 1 as const, items: [] }))
})

afterEach(() => vault.cleanup())

const append = (value: number) =>
  store.update((current) => ({ next: { ...current, items: [...current.items, value] }, result: value }))

describe('JsonStore', () => {
  it('ファイルが無ければ初期値を返す', async () => {
    expect(await store.read()).toEqual({ version: 1, items: [] })
  })

  it('JSON が壊れていたら、ファイル名を示して失敗する', async () => {
    await append(1)
    await writeFile(file, '{broken', 'utf8')

    await expect(store.read()).rejects.toThrow('.study/numbers.json')
  })

  it('形が想定と違えば失敗する', async () => {
    await append(1)
    await writeFile(file, '{"version":2,"items":[]}', 'utf8')

    await expect(store.read()).rejects.toThrow('想定と違います')
  })

  it('同時に来た更新を取りこぼさず順に反映する', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, index) => append(index)))

    const { items } = await store.read()
    expect([...items].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, index) => index))
  })

  it('途中の更新が失敗しても、失敗はその呼び出しに返り、後の更新は反映される', async () => {
    const failing = store.update(() => {
      throw new Error('わざと失敗')
    })
    const following = append(7)

    await expect(failing).rejects.toThrow('わざと失敗')
    await expect(following).resolves.toBe(7)
    expect((await store.read()).items).toEqual([7])
  })

  it('書き込み後に一時ファイルを残さない', async () => {
    await append(1)

    expect(await readdir(join(vault.dir, '.study'))).toEqual(['numbers.json'])
  })
})
