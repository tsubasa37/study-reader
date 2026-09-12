import { mkdir, readdir, rename } from 'node:fs/promises'
import { basename, dirname, extname, join, posix } from 'node:path'
import type { MoveDocument } from '../shared/schemas'
import type { MoveDocumentResult } from '../shared/types'
import { HttpError } from './errors'
import { isFile } from './files'
import type { StudyRepository } from './studyRepository'
import { resolveProjectFolder, resolveVaultPath, scanDocuments } from './vault'

// 資料をプロジェクト（フォルダ）へ移す。同じ名前の別拡張子（対の PDF など）も一緒に動かし、記録も付け替える
export async function moveDocument(
  vaultDir: string,
  repository: StudyRepository,
  { path, folder }: MoveDocument,
): Promise<MoveDocumentResult> {
  const documents = await scanDocuments(vaultDir)
  const document = documents.find((candidate) => candidate.path === path)
  if (document === undefined) throw new HttpError(404, `資料が見つかりません: ${path}`)
  if (document.folder === folder) {
    throw new HttpError(400, folder === '' ? 'すでに資料フォルダの直下にあります' : `すでに「${folder}」にあります`)
  }

  const sourceDir = dirname(resolveVaultPath(vaultDir, path))
  const targetDir = resolveProjectFolder(vaultDir, folder)
  const stem = basename(path, extname(path))
  const entries = await readdir(sourceDir, { withFileTypes: true })
  const names = entries
    .filter(
      (entry) => entry.isFile() && !entry.name.startsWith('.') && basename(entry.name, extname(entry.name)) === stem,
    )
    .map((entry) => entry.name)

  const shown = (name: string) => (folder === '' ? name : posix.join(folder, name))

  // 1つでもぶつかるなら、1つも動かさない
  for (const name of names) {
    if (await isFile(join(targetDir, name))) {
      throw new HttpError(409, `移動先に同じ名前のファイルがあります: ${shown(name)}`)
    }
  }

  await mkdir(targetDir, { recursive: true })
  const movedFiles: string[] = []
  for (const name of names) {
    await rename(join(sourceDir, name), join(targetDir, name))
    movedFiles.push(shown(name))
  }

  const newPath = shown(basename(path))
  const records = await repository.relocateRecords(path, newPath)
  return { path: newPath, movedFiles, records }
}
