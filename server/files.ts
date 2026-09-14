import { lstat, readFile, stat } from 'node:fs/promises'
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

// 教材の中のスクリプトは動いたままにして（教材自身の目次や色付けが壊れるため）、
// 外との通信と外部ファイルの読み込みは止める（教材が使う Google Fonts だけ許可）。
// ただし親画面と同じオリジンで表示するので、教材のスクリプトが親画面を通して通信することまでは防げない
export const VAULT_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

export function contentTypeFor(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
}

export type SendFileOptions = {
  csp?: string
}

export async function sendFile(c: Context, file: string, options: SendFileOptions = {}): Promise<Response> {
  let info: Awaited<ReturnType<typeof stat>>
  try {
    info = await stat(file)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) throw new HttpError(404, `ファイルがありません: ${basename(file)}`)
    throw error
  }
  if (!info.isFile()) throw new HttpError(404, `ファイルがありません: ${basename(file)}`)

  // 秒単位に落として比較する（Last-Modified はミリ秒を持てない）
  const modifiedAt = Math.floor(info.mtimeMs / 1000) * 1000
  const headers: Record<string, string> = {
    'Content-Type': contentTypeFor(file),
    'Cache-Control': 'no-cache',
    'Last-Modified': new Date(modifiedAt).toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  }
  if (options.csp !== undefined) headers['Content-Security-Policy'] = options.csp

  const since = c.req.header('if-modified-since')
  if (since !== undefined) {
    const sinceMs = Date.parse(since)
    if (Number.isFinite(sinceMs) && modifiedAt <= sinceMs) return c.body(null, 304, headers)
  }

  const data = await readFile(file)
  // Buffer はコピーせず、同じメモリを見る形で渡す
  return c.body(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), 200, headers)
}

export async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return false
    throw error
  }
}

// ファイル・フォルダ・リンク（切れたリンクも含む）が「何かある」かどうか
export async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target)
    return true
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return false
    throw error
  }
}

export function decodePathname(url: string, prefix: string): string {
  const pathname = new URL(url).pathname.slice(prefix.length)
  try {
    return pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')
  } catch {
    throw new HttpError(400, `URL の書き方が正しくありません: ${pathname}`)
  }
}
