import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { loadConfig } from './config'
import { isFile } from './files'

const projectRoot = resolve(import.meta.dirname, '..')
const config = await loadConfig(resolve(projectRoot, 'study-reader.config.json'))

const serveClient = process.argv.includes('--serve-client')
const clientDir = serveClient ? resolve(projectRoot, 'dist') : null
if (clientDir !== null && !(await isFile(resolve(clientDir, 'index.html')))) {
  throw new Error('画面のビルドがありません。npm start で起動してください（ビルドしてから起動します）')
}

const app = createApp({ vaultDir: config.vaultDir, clientDir })

serve({ fetch: app.fetch, port: config.port, hostname: '127.0.0.1' }, (info) => {
  const url = serveClient ? `http://127.0.0.1:${info.port}` : `API http://127.0.0.1:${info.port}`
  console.info(`つづき: ${url}（資料フォルダ: ${config.vaultDir}）`)
})
