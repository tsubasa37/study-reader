import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { hasErrorCode } from './errors'

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // 別の利用者のプロセスでも「動いている」と分かる
    return hasErrorCode(error, 'EPERM')
  }
}

// 同じ資料フォルダを2つのサーバーが触ると、記録の読み書きが競合して消える。
// 起動時に印を置き、すでに動いているサーバーがあれば起動しない
export async function acquireVaultLock(lockFile: string): Promise<() => void> {
  await mkdir(dirname(lockFile), { recursive: true })
  const existing = await readFile(lockFile, 'utf8').catch((error: unknown) => {
    if (hasErrorCode(error, 'ENOENT')) return null
    throw error
  })
  if (existing !== null) {
    const pid = Number.parseInt(existing.trim(), 10)
    if (Number.isFinite(pid) && pid !== process.pid && isRunning(pid)) {
      throw new Error(
        `この資料フォルダは、すでに別のサーバー（PID ${pid}）が使っています。そちらを止めてから起動してください`,
      )
    }
  }
  await writeFile(lockFile, `${process.pid}\n`, 'utf8')

  let released = false
  return () => {
    if (released) return
    released = true
    try {
      rm(lockFile, { force: true })
    } catch {
      // 終了処理なので、消せなくても起動中の動作には影響しない
    }
  }
}
