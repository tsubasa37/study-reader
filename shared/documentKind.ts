import type { DocumentKind } from './types'

const KINDS: Record<string, DocumentKind> = {
  '.html': 'html',
  '.htm': 'html',
  '.pdf': 'pdf',
}

// 拡張子から資料の種類を決める。資料として扱わないファイルは null
export function documentKindOf(fileName: string): DocumentKind | null {
  const name = fileName.slice(fileName.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? null : (KINDS[name.slice(dot).toLowerCase()] ?? null)
}
