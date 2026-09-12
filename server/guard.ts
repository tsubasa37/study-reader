import type { Context, Next } from 'hono'

// このアプリは同じ PC の中だけで使う。外部サイトのページから叩かれないよう、入口で断る
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

export function hostnameOf(host: string): string {
  const match = /^(\[[^\]]+\]|[^:]+)(?::\d+)?$/.exec(host.trim())
  return (match?.[1] ?? '').toLowerCase()
}

export function isLocalHost(host: string | undefined): boolean {
  return host !== undefined && LOCAL_HOSTNAMES.has(hostnameOf(host))
}

export function isLocalOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true
  try {
    return isLocalHost(new URL(origin).host)
  } catch {
    return false
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export async function guard(c: Context, next: Next): Promise<Response | void> {
  // 別名のドメインを 127.0.0.1 に向ける手口（DNS リバインディング）を断つ。
  // Host ヘッダーが無い呼び出し（テストなど）では、URL のホストで見る
  const host = c.req.header('host') ?? new URL(c.req.url).host
  if (!isLocalHost(host)) {
    return c.json({ error: 'このアプリは同じ PC からのみ使えます' }, 403)
  }
  const site = c.req.header('sec-fetch-site')
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    return c.json({ error: '外部サイトからの操作は受け付けません' }, 403)
  }
  if (!isLocalOrigin(c.req.header('origin'))) {
    return c.json({ error: '外部サイトからの操作は受け付けません' }, 403)
  }
  // 本文付きの書き込みは application/json だけ受ける。
  // text/plain を許すと、外部サイトが事前確認なしで送れてしまう
  if (!SAFE_METHODS.has(c.req.method) && c.req.header('content-length') !== '0') {
    const type = (c.req.header('content-type') ?? '').toLowerCase()
    const hasBody = type !== '' || c.req.method !== 'DELETE'
    if (hasBody && !type.startsWith('application/json')) {
      return c.json({ error: '本文は application/json で送ってください' }, 415)
    }
  }
  await next()
}
