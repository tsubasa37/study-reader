import { realpath, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../../server/config'
import { createTempVault, type TempVault } from './helpers'

let vault: TempVault
let configFile: string

beforeEach(async () => {
  vault = await createTempVault({})
  configFile = join(vault.dir, 'study-reader.config.json')
})

afterEach(() => vault.cleanup())

const writeConfig = (config: unknown) => writeFile(configFile, JSON.stringify(config), 'utf8')

describe('loadConfig', () => {
  it('資料フォルダとポートを返す', async () => {
    await writeConfig({ vaultDir: vault.dir, port: 4799 })

    expect(await loadConfig(configFile)).toEqual({ vaultDir: vault.dir, port: 4799 })
  })

  it('~ をホームフォルダに置き換える', async () => {
    await writeConfig({ vaultDir: '~', port: 4799 })

    expect((await loadConfig(configFile)).vaultDir).toBe(await realpath(homedir()))
  })

  it('設定ファイルが無ければ作り方を案内する', async () => {
    await expect(loadConfig(join(vault.dir, 'missing.json'))).rejects.toThrow('study-reader.config.example.json')
  })

  it('資料フォルダが無ければ失敗する', async () => {
    await writeConfig({ vaultDir: join(vault.dir, 'missing'), port: 4799 })

    await expect(loadConfig(configFile)).rejects.toThrow('資料フォルダが見つかりません')
  })
})
