import { join, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { isFile } from './files'
import { acquireVaultLock } from './lock'
import { STATE_DIR_NAME } from './vault'

const projectRoot = resolve(import.meta.dirname, '..')
const config = await loadConfig(resolve(projectRoot, 'study-reader.config.json'))

const serveClient = process.argv.includes('--serve-client')
const clientDir = serveClient ? resolve(projectRoot, 'dist') : null
if (clientDir !== null && !(await isFile(resolve(clientDir, 'index.html')))) {
  throw new Error('画面のビルドがありません。npm start で起動してください（ビルドしてから起動します）')
}

// 同じ資料フォルダを2つのサーバーが触ると記録が消えるので、1つだけに絞る
const releaseLock = await acquireVaultLock(join(config.vaultDir, STATE_DIR_NAME, 'server.lock'))
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    releaseLock()
    process.exit(0)
  })
}
process.on('exit', releaseLock)

const app = createApp({ vaultDir: config.vaultDir, clientDir })

serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
  const url = serveClient ? `http://127.0.0.1:${info.port}` : `API http://127.0.0.1:${info.port}`
  console.info(`つづき: ${url}（資料フォルダ: ${config.vaultDir}）`)
})
