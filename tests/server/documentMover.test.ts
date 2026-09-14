import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { moveDocument } from '../../server/documentMover'
import { HttpError } from '../../server/errors'
import { createStudyRepository } from '../../server/studyRepository'
import { createTempVault, type TempVault } from './helpers'

// ファイルの移動（rename）を、指定した回だけ失敗させる
const renames = vi.hoisted(() => ({ count: 0, failAt: new Set<number>() }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rename: async (from: string, to: string) => {
      renames.count++
      if (renames.failAt.has(renames.count)) throw new Error(`書き込めません（${renames.count}回目）`)
      return actual.rename(from, to)
    },
  }
})

const DOC = '教材.html'
const FOLDER = 'プロジェクト'

let vault: TempVault

beforeEach(async () => {
  vault = await createTempVault({ [DOC]: '<p>本文</p>', '教材.pdf': 'pdf' })
  renames.count = 0
  renames.failAt = new Set()
})

afterEach(() => vault.cleanup())

async function failedMove(): Promise<HttpError> {
  const reason = await moveDocument(vault.dir, createStudyRepository(vault.dir), { path: DOC, folder: FOLDER }).then(
    () => null,
    (error: unknown) => error,
  )
  if (!(reason instanceof HttpError)) throw new Error(`HttpError で失敗するはずが、結果は ${String(reason)}`)
  return reason
}

describe('資料の移動が途中で失敗したとき', () => {
  it('動かした分を元の場所に戻して知らせる', async () => {
    renames.failAt = new Set([2])

    const error = await failedMove()

    expect(error.status).toBe(500)
    expect(error.message).toContain('元の場所に戻しました')
    expect((await readdir(vault.dir)).sort()).toEqual([DOC, '教材.pdf', FOLDER].sort())
    expect(await readdir(join(vault.dir, FOLDER))).toEqual([])
  })

  it('元に戻せなかったファイルがあれば、戻したとは言わず、残った場所を伝える', async () => {
    renames.failAt = new Set([2, 3])

    const error = await failedMove()

    const stranded = await readdir(join(vault.dir, FOLDER))
    expect(stranded).toHaveLength(1)
    expect(error.status).toBe(500)
    expect(error.message).not.toContain('元の場所に戻しました')
    expect(error.message).toContain(`${FOLDER}/${stranded[0]}`)
    expect(error.message).toContain('書き込めません（3回目）')
  })
})
