// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_NAV_WIDTH,
  MIN_NAV_WIDTH,
  applyDocChrome,
  clampNavWidth,
  docChromeCss,
  isDockedNav,
  loadDocNavHidden,
  loadDocNavWidth,
  saveDocNavHidden,
  saveDocNavWidth,
  type DocNavMetrics,
} from '../../src/lib/documentChrome'
import { parseHtml } from './helpers'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

const gridNav: DocNavMetrics = { navLeft: 0, navWidth: 288, mainMarginLeft: 0, inGrid: true }
const fixedNav: DocNavMetrics = { navLeft: 0, navWidth: 270, mainMarginLeft: 292, inGrid: false }

describe('docChromeCss', () => {
  it('隠すときは、目次を消して本文の余白と列も詰める', () => {
    const css = docChromeCss({ hidden: true, width: 260 }, gridNav)

    expect(css).toContain('nav { display: none !important; }')
    expect(css).toContain('main { margin-left: 0 !important; }')
    expect(css).toContain(':has(> nav) { grid-template-columns: minmax(0, 1fr) !important; }')
  })

  it('目次が列として並ぶ教材は、列の幅を変える', () => {
    expect(docChromeCss({ hidden: false, width: 200 }, gridNav)).toContain(
      ':has(> nav) { grid-template-columns: 200px minmax(0, 1fr) !important; }',
    )
  })

  it('目次が固定配置の教材は、目次の幅と本文の余白を動かし、元の隙間を保つ', () => {
    const css = docChromeCss({ hidden: false, width: 200 }, fixedNav)

    expect(css).toContain('nav { width: 200px !important; }')
    // 元の隙間 292 - 270 = 22px を足す
    expect(css).toContain('main { margin-left: 222px !important; }')
  })

  it('幅を決めていない、または測れていない教材には何もしない', () => {
    expect(docChromeCss({ hidden: false, width: null }, gridNav)).toBe('')
    expect(docChromeCss({ hidden: false, width: 200 }, null)).toBe('')
  })
})

describe('applyDocChrome', () => {
  const doc = () => parseHtml('<nav id="toc">目次</nav><main><p>本文</p></main>')

  it('指定を head に足し、何度呼んでも1つだけ', () => {
    const document = doc()

    applyDocChrome(document, { hidden: true, width: null }, gridNav)
    applyDocChrome(document, { hidden: true, width: null }, gridNav)

    expect(document.querySelectorAll('#study-reader-doc-chrome')).toHaveLength(1)
  })

  it('幅を変えると指定が置き換わる', () => {
    const document = doc()

    applyDocChrome(document, { hidden: false, width: 200 }, gridNav)
    applyDocChrome(document, { hidden: false, width: 320 }, gridNav)

    expect(document.getElementById('study-reader-doc-chrome')?.textContent).toContain('320px minmax(0, 1fr)')
  })

  it('元に戻すと指定を取り除き、教材は元の見た目に戻る', () => {
    const document = doc()

    applyDocChrome(document, { hidden: true, width: 200 }, gridNav)
    applyDocChrome(document, { hidden: false, width: null }, gridNav)

    expect(document.getElementById('study-reader-doc-chrome')).toBeNull()
    expect(document.querySelector('nav')?.textContent).toBe('目次')
  })
})

describe('isDockedNav', () => {
  it.each([
    ['左端に接している目次', { left: 0, right: 292, width: 292 }, 1440, true],
    ['本文ごと中央寄せの教材の目次', { left: 121, right: 369, width: 248 }, 1440, true],
    ['画面の外に隠れている引き出し式の目次', { left: -326, right: -6, width: 320 }, 800, false],
    ['目次と呼べない細い帯', { left: 0, right: 40, width: 40 }, 1440, false],
    ['右側にある補助のナビ', { left: 1100, right: 1300, width: 200 }, 1440, false],
  ])('%s は %s', (_name, rect, viewportWidth, expected) => {
    expect(isDockedNav(rect, viewportWidth)).toBe(expected)
  })
})

describe('clampNavWidth', () => {
  it.each([
    [80, MIN_NAV_WIDTH],
    [900, MAX_NAV_WIDTH],
    [245.4, 245],
    [Number.NaN, MIN_NAV_WIDTH],
  ])('%s は %s にそろえる', (input, expected) => {
    expect(clampNavWidth(input)).toBe(expected)
  })
})

describe('好みの保存', () => {
  it('隠す設定を読み戻す', () => {
    saveDocNavHidden(true)

    expect(loadDocNavHidden()).toBe(true)
  })

  it('幅を読み戻し、元に戻すと記録も消える', () => {
    saveDocNavWidth(240)
    expect(loadDocNavWidth()).toBe(240)

    saveDocNavWidth(null)
    expect(loadDocNavWidth()).toBeNull()
  })

  it('localStorage が使えない環境でも既定のまま動く', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage は使えません')
    })

    expect(loadDocNavHidden()).toBe(false)
    expect(loadDocNavWidth()).toBeNull()
  })
})
