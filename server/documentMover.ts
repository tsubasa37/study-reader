import { mkdir, readdir, rename } from 'node:fs/promises'
import { basename, dirname, extname, join, posix } from 'node:path'
import type { MoveDocument } from '../shared/schemas'
import type { MoveDocumentResult } from '../shared/types'
import { HttpError } from './errors'
import { pathExists } from './files'
import type { StudyRepository } from './studyRepository'
import { realProjectFolder, realVaultPath, scanDocuments } from './vault'

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

  // 実体で確かめる。リンクで資料フォルダの外を指していれば、ここで弾かれる
  const sourceDir = dirname(await realVaultPath(vaultDir, path))
  const targetDir = await realProjectFolder(vaultDir, folder)
  const stem = basename(path, extname(path))
  const entries = await readdir(sourceDir, { withFileTypes: true })
  // 拡張子のあるふつうのファイルだけ。リンクや拡張子なしのファイルは巻き込まない
  const names = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.startsWith('.') &&
        extname(entry.name) !== '' &&
        basename(entry.name, extname(entry.name)) === stem,
    )
    .map((entry) => entry.name)

  const shown = (name: string) => (folder === '' ? name : posix.join(folder, name))

  // 1つでもぶつかるなら、1つも動かさない（フォルダ・切れたリンクも「ある」とみなす）
  for (const name of names) {
    if (await pathExists(join(targetDir, name))) {
      throw new HttpError(409, `移動先に同じ名前のものがあります: ${shown(name)}`)
    }
  }

  await mkdir(targetDir, { recursive: true })
  const moved: { from: string; to: string; name: string }[] = []
  try {
    for (const name of names) {
      const from = join(sourceDir, name)
      const to = join(targetDir, name)
      await rename(from, to)
      moved.push({ from, to, name })
    }
  } catch (error) {
    // 途中で失敗したら、動かした分を元に戻してから知らせる
    for (const done of [...moved].reverse()) {
      await rename(done.to, done.from).catch(() => undefined)
    }
    throw new HttpError(500, `移動できませんでした（${(error as Error).message}）。元の場所に戻しました`)
  }

  const newPath = shown(basename(path))
  const records = await repository.relocateRecords(path, newPath)
  return { path: newPath, movedFiles: moved.map(({ name }) => shown(name)), records }
}
