import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { Context } from 'hono'
import { HttpError, hasErrorCode } from './errors'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
}

export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export async function sendFile(c: Context, file: string): Promise<Response> {
  let data: Buffer
  try {
    data = await readFile(file)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'EISDIR')) {
      throw new HttpError(404, `ファイルがありません: ${basename(file)}`)
    }
    throw error
  }
  return c.body(new Uint8Array(data), 200, {
    'Content-Type': contentTypeFor(file),
    'Cache-Control': 'no-cache',
  })
}

export async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return false
    throw error
  }
}

export function decodePathname(url: string, prefix: string): string {
  const pathname = new URL(url).pathname.slice(prefix.length)
  try {
    return pathname.split('/').map((segment) => decodeURIComponent(segment)).join('/')
  } catch {
    throw new HttpError(400, `URL の書き方が正しくありません: ${pathname}`)
  }
}
