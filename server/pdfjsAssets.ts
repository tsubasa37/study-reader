import { realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, sep } from 'node:path'
import { HttpError, hasErrorCode } from './errors'

// PDF の表示中に pdf.js が取りに来る付属ファイル（文字の対応表・欧文の書体・画像の読み取り部品・色の変換表）
const ASSET_DIRS = new Set(['cmaps', 'standard_fonts', 'wasm', 'iccs'])

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'))

// 決めたフォルダの中の実ファイルだけを返す。pdf.js の本体やフォルダの外は配信しない
export async function realPdfjsAssetPath(relativePath: string): Promise<string> {
  const segments = relativePath.split('/')
  const unsafe = segments.some(
    (segment) => segment === '' || segment.startsWith('.') || segment.includes('\\') || segment.includes('\0'),
  )
  if (unsafe) throw new HttpError(400, `使えないファイル名です: ${relativePath}`)
  const [dir, ...rest] = segments
  if (dir === undefined || !ASSET_DIRS.has(dir) || rest.length === 0) {
    throw new HttpError(404, `ファイルがありません: ${relativePath}`)
  }
  try {
    const base = await realpath(resolve(pdfjsRoot, dir))
    const real = await realpath(resolve(base, ...rest))
    if (!real.startsWith(base + sep)) throw new HttpError(404, `ファイルがありません: ${relativePath}`)
    return real
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) throw new HttpError(404, `ファイルがありません: ${relativePath}`)
    throw error
  }
}
