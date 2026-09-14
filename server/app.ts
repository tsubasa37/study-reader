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
  SettingsSchema,
} from '../shared/schemas'
import type { DocumentEntry, DocumentList } from '../shared/types'
import { bodyLimit } from 'hono/body-limit'
import { HttpError } from './errors'
import { moveDocument } from './documentMover'
import { VAULT_CSP, decodePathname, isFile, sendFile } from './files'
import { guard } from './guard'
import { reconcileRecords } from './reconcile'
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

  // フォルダの中身を見て、記録の名札を実態に合わせてから返す
  async function currentDocuments(): Promise<DocumentEntry[]> {
    const documents = await scanDocuments(vaultDir)
    await reconcileRecords(repository, documents)
    return documents
  }

  app.get('/api/documents', async (c) => {
    const list: DocumentList = { vaultName: basename(vaultDir), documents: await currentDocuments() }
    return c.json(list)
  })
  app.get('/api/state', async (c) => {
    await currentDocuments()
    return c.json(await repository.state())
  })
  app.post('/api/documents/move', async (c) =>
    c.json(await moveDocument(vaultDir, repository, MoveDocumentSchema.parse(await readJson(c)))),
  )
  app.put('/api/progress', async (c) => {
    const entry = DocumentProgressSchema.parse(await readJson(c))
    await assertDocument(vaultDir, entry.path)
    return c.json(await repository.saveProgress(entry))
  })

  app.get('/api/settings', async (c) => c.json(await repository.settings()))
  app.put('/api/settings', async (c) =>
    c.json(await repository.saveSettings(SettingsSchema.parse(await readJson(c)))),
  )

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
