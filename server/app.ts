import { basename, join, resolve, sep } from 'node:path'
import { Hono, type Context } from 'hono'
import { ZodError, z } from 'zod'
import {
  BookmarkPatchSchema,
  DocumentProgressSchema,
  HighlightPatchSchema,
  MoveDocumentSchema,
  NewBookmarkSchema,
  NewHighlightSchema,
  RecordsMoveSchema,
} from '../shared/schemas'
import type { DocumentList } from '../shared/types'
import { bodyLimit } from 'hono/body-limit'
import { HttpError } from './errors'
import { moveDocument } from './documentMover'
import { VAULT_CSP, decodePathname, isFile, sendFile } from './files'
import { guard } from './guard'
import { createStudyRepository } from './studyRepository'
import { realVaultPath, resolveVaultPath, scanDocuments } from './vault'

const MAX_BODY_BYTES = 1_000_000

// 記録の宛先は実在する資料だけにする。消えた資料の記録で上書きしない
async function documentExists(vaultDir: string, path: string): Promise<boolean> {
  try {
    return await isFile(await realVaultPath(vaultDir, path))
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return false
    throw error
  }
}

async function assertDocument(vaultDir: string, path: string): Promise<void> {
  if (!(await documentExists(vaultDir, path))) {
    throw new HttpError(404, `資料が見つかりません: ${path}`)
  }
}

export type AppOptions = {
  vaultDir: string
  clientDir: string | null
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch (error) {
    throw new HttpError(400, `JSON として読めません: ${(error as Error).message}`)
  }
}

export function createApp({ vaultDir, clientDir }: AppOptions): Hono {
  const repository = createStudyRepository(vaultDir)
  const app = new Hono()

  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status)
    if (error instanceof ZodError) return c.json({ error: `送られた内容が正しくありません\n${z.prettifyError(error)}` }, 400)
    console.error(error)
    return c.json({ error: error.message }, 500)
  })
  app.notFound((c) => c.json({ error: `見つかりません: ${new URL(c.req.url).pathname}` }, 404))

  app.use('*', guard)
  app.use('/api/*', bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: '送られた内容が大きすぎます' }, 413) }))

  app.get('/api/documents', async (c) => {
    const list: DocumentList = { vaultName: basename(vaultDir), documents: await scanDocuments(vaultDir) }
    return c.json(list)
  })
  app.get('/api/state', async (c) => c.json(await repository.state()))
  app.post('/api/documents/move', async (c) =>
    c.json(await moveDocument(vaultDir, repository, MoveDocumentSchema.parse(await readJson(c)))),
  )
  app.put('/api/progress', async (c) => {
    const entry = DocumentProgressSchema.parse(await readJson(c))
    await assertDocument(vaultDir, entry.path)
    return c.json(await repository.saveProgress(entry))
  })

  app.post('/api/bookmarks', async (c) => {
    const input = NewBookmarkSchema.parse(await readJson(c))
    await assertDocument(vaultDir, input.path)
    return c.json(await repository.bookmarks.add(input), 201)
  })
  app.patch('/api/bookmarks/:id', async (c) =>
    c.json(await repository.bookmarks.update(c.req.param('id'), BookmarkPatchSchema.parse(await readJson(c)))),
  )
  app.delete('/api/bookmarks/:id', async (c) => {
    await repository.bookmarks.remove(c.req.param('id'))
    return c.body(null, 204)
  })

  app.post('/api/highlights', async (c) => {
    const input = NewHighlightSchema.parse(await readJson(c))
    await assertDocument(vaultDir, input.path)
    return c.json(await repository.highlights.add(input), 201)
  })
  app.patch('/api/highlights/:id', async (c) =>
    c.json(await repository.highlights.update(c.req.param('id'), HighlightPatchSchema.parse(await readJson(c)))),
  )
  app.delete('/api/highlights/:id', async (c) => {
    await repository.highlights.remove(c.req.param('id'))
    return c.body(null, 204)
  })

  app.post('/api/records/move', async (c) => {
    const move = RecordsMoveSchema.parse(await readJson(c))
    if (!(await documentExists(vaultDir, move.to))) {
      throw new HttpError(400, `引き継ぎ先の資料がありません: ${move.to}`)
    }
    return c.json(await repository.moveRecords(move))
  })
  app.delete('/api/records', async (c) => {
    const path = c.req.query('path')
    if (path === undefined || path === '') throw new HttpError(400, '記録を消す資料の path を指定してください')
    return c.json(await repository.deleteRecords(path))
  })

  app.get('/vault/*', async (c) =>
    sendFile(c, await realVaultPath(vaultDir, decodePathname(c.req.url, '/vault/')), { csp: VAULT_CSP }),
  )

  if (clientDir !== null) {
    app.get('*', async (c) => {
      const pathname = decodePathname(c.req.url, '')
      if (pathname.startsWith('/api/')) throw new HttpError(404, `見つかりません: ${pathname}`)
      const asset = resolve(clientDir, `.${pathname}`)
      if (asset.startsWith(clientDir + sep) && (await isFile(asset))) return sendFile(c, asset)
      return sendFile(c, join(clientDir, 'index.html'))
    })
  }

  return app
}
