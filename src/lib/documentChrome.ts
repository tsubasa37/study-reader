export type DocNavMetrics = {
  navLeft: number
  navWidth: number
  mainMarginLeft: number
  inGrid: boolean
}

export type DocChrome = {
  hidden: boolean
  width: number | null
}

const STYLE_ID = 'study-reader-doc-chrome'
const HIDDEN_KEY = 'study-reader:hide-doc-nav'
const WIDTH_KEY = 'study-reader:doc-nav-width'

export const MIN_NAV_WIDTH = 140
export const MAX_NAV_WIDTH = 520

// 教材が自前で持つ目次（nav）を、教材のファイルを書き換えずに隠す。
// 隠すだけでは本文が広がらない教材があるので、目次のために空けてある余白と列も詰める
const HIDE_CSS = `nav { display: none !important; }
main { margin-left: 0 !important; }
:has(> nav) { grid-template-columns: minmax(0, 1fr) !important; }`

export function clampNavWidth(width: number): number {
  if (!Number.isFinite(width)) return MIN_NAV_WIDTH
  return Math.round(Math.min(MAX_NAV_WIDTH, Math.max(MIN_NAV_WIDTH, width)))
}

// 幅を変えられる目次と認める条件。画面が狭いときの引き出し式の目次（画面の外に隠れている）は対象にしない。
// 本文ごと中央寄せの教材では目次の左端が 0 ではないので、左端の位置ではなく「見えているか・左半分にあるか」で見る
const MIN_DOCKED_WIDTH = 80

export function isDockedNav(rect: { left: number; right: number; width: number }, viewportWidth: number): boolean {
  return rect.width >= MIN_DOCKED_WIDTH && rect.right > 0 && rect.left >= -1 && rect.left < viewportWidth / 2
}

// 教材ごとに目次の作りが違うので、変える前に実際の寸法を測る
export function measureDocumentNav(doc: Document): DocNavMetrics | null {
  const nav = doc.querySelector('nav')
  const view = doc.defaultView
  if (nav === null || view === null) return null
  const rect = nav.getBoundingClientRect()
  const navWidth = rect.width
  if (!isDockedNav(rect, view.innerWidth)) return null
  const main = doc.querySelector('main')
  const mainMarginLeft = main === null ? 0 : Number.parseFloat(view.getComputedStyle(main).marginLeft) || 0
  const parent = nav.parentElement
  const inGrid = parent !== null && view.getComputedStyle(parent).display.includes('grid')
  return { navLeft: rect.left, navWidth, mainMarginLeft, inGrid }
}

export function docChromeCss(chrome: DocChrome, metrics: DocNavMetrics | null): string {
  if (chrome.hidden) return HIDE_CSS
  if (chrome.width === null || metrics === null) return ''
  const width = clampNavWidth(chrome.width)
  if (metrics.inGrid) {
    // 目次が列として並ぶ教材（列の幅を変える）
    return `:has(> nav) { grid-template-columns: ${width}px minmax(0, 1fr) !important; }
nav { width: auto !important; }`
  }
  // 目次が固定配置の教材（目次の幅と本文の余白を動かし、元の隙間は保つ）
  const gap = Math.max(0, Math.round(metrics.mainMarginLeft - metrics.navWidth))
  return `nav { width: ${width}px !important; }
main { margin-left: ${width + gap}px !important; }`
}

export function applyDocChrome(doc: Document, chrome: DocChrome, metrics: DocNavMetrics | null): void {
  const text = docChromeCss(chrome, metrics)
  const existing = doc.getElementById(STYLE_ID)
  if (text === '') {
    existing?.remove()
    return
  }
  const style = existing ?? doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = text
  if (existing === null) doc.head.append(style)
}

// 表示の好みはこのブラウザだけのもの。読めない・書けない環境でも教材は開ける
export function loadDocNavHidden(): boolean {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

export function saveDocNavHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0')
  } catch {
    // 覚えられなくても、この画面では切り替わる
  }
}

export function loadDocNavWidth(): number | null {
  try {
    const saved = window.localStorage.getItem(WIDTH_KEY)
    if (saved === null) return null
    const width = Number.parseInt(saved, 10)
    return Number.isFinite(width) ? clampNavWidth(width) : null
  } catch {
    return null
  }
}

export function saveDocNavWidth(width: number | null): void {
  try {
    if (width === null) window.localStorage.removeItem(WIDTH_KEY)
    else window.localStorage.setItem(WIDTH_KEY, String(clampNavWidth(width)))
  } catch {
    // 覚えられなくても、この画面では変わる
  }
}
