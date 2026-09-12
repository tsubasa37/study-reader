import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export type TempVault = {
  dir: string
  cleanup: () => Promise<void>
}

export async function createTempVault(files: Record<string, string>): Promise<TempVault> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'study-reader-')))
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, content, 'utf8')
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}
