import type { Dirent } from 'node:fs'
import { readdir, realpath, stat } from 'node:fs/promises'
import { basename, extname, join, posix, relative, resolve, sep } from 'node:path'
import type { DocumentEntry, DocumentKind } from '../shared/types'
import { HttpError, hasErrorCode } from './errors'

export const STATE_DIR_NAME = '.study'

const DOCUMENT_KINDS: Record<string, DocumentKind> = {
  '.html': 'html',
  '.htm': 'html',
  '.pdf': 'pdf',
}

export async function scanDocuments(vaultDir: string): Promise<DocumentEntry[]> {
  const documents: DocumentEntry[] = []
  await collect(vaultDir, vaultDir, documents)
  return documents.sort((a, b) => a.path.localeCompare(b.path, 'ja'))
}

async function collect(vaultDir: string, dir: string, documents: DocumentEntry[]): Promise<void> {
  const entries: Dirent[] = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collect(vaultDir, fullPath, documents)
      continue
    }
    const extension = extname(entry.name)
    const kind = DOCUMENT_KINDS[extension.toLowerCase()]
    if (!entry.isFile() || kind === undefined) continue
    const info = await stat(fullPath)
    const path = relative(vaultDir, fullPath).split(sep).join('/')
    const folder = posix.dirname(path)
    documents.push({
      path,
      name: basename(entry.name, extension),
      folder: folder === '.' ? '' : folder,
      kind,
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
    })
  }
}

// プロジェクトのフォルダは資料フォルダ直下の1段だけ。'' は資料フォルダそのもの
export function resolveProjectFolder(vaultDir: string, folder: string): string {
  if (folder === '') return vaultDir
  const unsafe =
    folder !== folder.trim() ||
    folder.startsWith('.') ||
    folder.includes('/') ||
    folder.includes('\\') ||
    folder.includes('\0')
  if (unsafe) throw new HttpError(400, `プロジェクト名に使えない文字が入っています: ${folder}`)
  const fullPath = resolve(vaultDir, folder)
  if (!fullPath.startsWith(vaultDir + sep)) throw new HttpError(400, `資料フォルダの外には作れません: ${folder}`)
  return fullPath
}

// リンクをたどった先まで見て、本当に資料フォルダの中かを確かめる
export async function realVaultPath(vaultDir: string, relativePath: string): Promise<string> {
  const fullPath = resolveVaultPath(vaultDir, relativePath)
  let real: string
  try {
    real = await realpath(fullPath)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) throw new HttpError(404, `ファイルがありません: ${relativePath}`)
    throw error
  }
  if (!real.startsWith(vaultDir + sep)) {
    throw new HttpError(400, `資料フォルダの外は開けません: ${relativePath}`)
  }
  return real
}

// 移動先のプロジェクトも実体で確かめる。まだ無いフォルダはこれから作るので、そのまま返す
export async function realProjectFolder(vaultDir: string, folder: string): Promise<string> {
  const fullPath = resolveProjectFolder(vaultDir, folder)
  if (folder === '') return fullPath
  let real: string
  try {
    real = await realpath(fullPath)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return fullPath
    throw error
  }
  if (!real.startsWith(vaultDir + sep)) {
    throw new HttpError(400, `プロジェクトの場所が資料フォルダの外を指しています: ${folder}`)
  }
  return real
}

export function resolveVaultPath(vaultDir: string, relativePath: string): string {
  const segments = relativePath.split('/')
  const unsafe = segments.some(
    (segment) => segment === '' || segment.startsWith('.') || segment.includes('\\') || segment.includes('\0'),
  )
  if (unsafe) {
    throw new HttpError(400, `資料フォルダの外や隠しファイルは開けません: ${relativePath}`)
  }
  const fullPath = resolve(vaultDir, ...segments)
  if (!fullPath.startsWith(vaultDir + sep)) {
    throw new HttpError(400, `資料フォルダの外は開けません: ${relativePath}`)
  }
  return fullPath
}
