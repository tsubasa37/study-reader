import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// PDF の表示中に pdf.js が取りに来る付属ファイルの置き場所（サーバーの /pdfjs/* が配信する）
export const PDFJS_ASSET_OPTIONS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  wasmUrl: '/pdfjs/wasm/',
  iccUrl: '/pdfjs/iccs/',
} as const

export type Pdfjs = {
  lib: typeof import('pdfjs-dist')
  viewer: typeof import('pdfjs-dist/web/pdf_viewer.mjs')
}

let loading: Promise<Pdfjs> | null = null

// pdf.js は大きいので PDF を開くときだけ読み込む。表示部品は本体を globalThis.pdfjsLib から参照するので、本体を先に置く
export function loadPdfjs(): Promise<Pdfjs> {
  loading ??= (async () => {
    const lib = await import('pdfjs-dist')
    lib.GlobalWorkerOptions.workerSrc = workerUrl
    ;(globalThis as { pdfjsLib?: unknown }).pdfjsLib = lib
    const viewer = await import('pdfjs-dist/web/pdf_viewer.mjs')
    return { lib, viewer }
  })().catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}
