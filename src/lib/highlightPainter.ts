import { HIGHLIGHT_COLORS, type HighlightColor } from '../../shared/constants'
import type { PaintEntry } from '../types/ui'

export const HIGHLIGHT_BACKGROUNDS: Record<HighlightColor, string> = {
  yellow: 'rgba(255, 214, 0, 0.42)',
  green: 'rgba(52, 199, 89, 0.32)',
  pink: 'rgba(255, 105, 150, 0.32)',
  blue: 'rgba(64, 156, 255, 0.32)',
}

// 色見本の丸。半透明の色を白に重ね、暗い画面でも蛍光ペンの色に見せる
export function swatchBackground(color: HighlightColor): string {
  return `linear-gradient(${HIGHLIGHT_BACKGROUNDS[color]}, ${HIGHLIGHT_BACKGROUNDS[color]}), #ffffff`
}

const STYLE_ID = 'study-reader-highlight-style'
const FLASH_NAME = 'study-flash'
const FLASH_MS = 1800

const nameFor = (color: HighlightColor) => `study-${color}`

type HighlightWindow = Window & {
  Highlight?: typeof Highlight
  CSS?: { highlights?: HighlightRegistry }
}

// 教材の HTML を書き換えずに色を重ねる（CSS Custom Highlight API）
function highlightApi(win: Window): { registry: HighlightRegistry; HighlightClass: typeof Highlight } {
  const target = win as HighlightWindow
  const registry = target.CSS?.highlights
  const HighlightClass = target.Highlight
  if (registry === undefined || HighlightClass === undefined) {
    throw new Error('このブラウザはハイライト表示に対応していません。Chrome か Safari 17.2 以降で開いてください')
  }
  return { registry, HighlightClass }
}

export function installHighlightStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = [
    ...HIGHLIGHT_COLORS.map(
      (color) => `::highlight(${nameFor(color)}) { background-color: ${HIGHLIGHT_BACKGROUNDS[color]}; }`,
    ),
    `::highlight(${FLASH_NAME}) { background-color: rgba(46, 76, 143, 0.38); }`,
  ].join('\n')
  doc.head.append(style)
}

export function paintHighlights(win: Window, entries: readonly PaintEntry[]): void {
  const { registry, HighlightClass } = highlightApi(win)
  for (const color of HIGHLIGHT_COLORS) {
    const ranges = entries.filter((entry) => entry.color === color).map((entry) => entry.range)
    registry.set(nameFor(color), new HighlightClass(...ranges))
  }
}

const flashTimers = new WeakMap<Window, ReturnType<typeof setTimeout>>()

export function flashRange(win: Window, range: Range): void {
  const { registry, HighlightClass } = highlightApi(win)
  registry.set(FLASH_NAME, new HighlightClass(range))
  const previous = flashTimers.get(win)
  if (previous !== undefined) clearTimeout(previous)
  flashTimers.set(
    win,
    setTimeout(() => registry.delete(FLASH_NAME), FLASH_MS),
  )
}
