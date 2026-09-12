import { readFile, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { z } from 'zod'
import { hasErrorCode } from './errors'

const ConfigSchema = z.object({
  vaultDir: z.string().min(1),
  port: z.number().int().min(1024).max(65535),
})

export type AppConfig = z.infer<typeof ConfigSchema>

export async function loadConfig(file: string): Promise<AppConfig> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) {
      throw new Error(`${file} がありません。study-reader.config.example.json をコピーして、資料フォルダの場所を書いてください`)
    }
    throw error
  }
  const config = ConfigSchema.parse(JSON.parse(text))
  const vaultDir = resolve(config.vaultDir.replace(/^~(?=$|\/)/, homedir()))
  let isDirectory: boolean
  try {
    isDirectory = (await stat(vaultDir)).isDirectory()
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) throw new Error(`資料フォルダが見つかりません: ${vaultDir}`)
    throw error
  }
  if (!isDirectory) throw new Error(`資料フォルダの場所がフォルダではありません: ${vaultDir}`)
  return { vaultDir: await realpath(vaultDir), port: config.port }
}
