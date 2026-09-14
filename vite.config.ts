import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const { port } = JSON.parse(
  readFileSync(new URL('./study-reader.config.json', import.meta.url), 'utf8'),
) as { port: number }

const apiServer = `http://127.0.0.1:${port}`

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': apiServer,
      '/vault': apiServer,
      '/pdfjs': apiServer,
    },
  },
})
