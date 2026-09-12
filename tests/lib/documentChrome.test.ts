// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyDocumentNavHidden,
  loadDocumentNavHidden,
  saveDocumentNavHidden,
} from '../../src/lib/documentChrome'
import { parseHtml } from './helpers'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

const doc = () => parseHtml('<nav id="toc">目次</nav><main><p>本文</p></main>')

describe('applyDocumentNavHidden', () => {
  it('教材の目次を隠す指定を head に足す（本文の余白と列も詰める）', () => {
    const document = doc()

    applyDocumentNavHidden(document, true)

    const style = document.getElementById('study-reader-hide-doc-nav')
    expect(style?.textContent).toContain('nav { display: none !important; }')
    expect(style?.textContent).toContain('main { margin-left: 0 !important; }')
    expect(style?.textContent).toContain(':has(> nav)')
  })

  it('何度呼んでも指定は1つだけ', () => {
    const document = doc()

    applyDocumentNavHidden(document, true)
    applyDocumentNavHidden(document, true)

    expect(document.querySelectorAll('#study-reader-hide-doc-nav')).toHaveLength(1)
  })

  it('戻すと指定を取り除き、教材は元の見た目に戻る', () => {
    const document = doc()

    applyDocumentNavHidden(document, true)
    applyDocumentNavHidden(document, false)

    expect(document.getElementById('study-reader-hide-doc-nav')).toBeNull()
    expect(document.querySelector('nav')?.textContent).toBe('目次')
  })
})

describe('好みの保存', () => {
  it('保存した設定を読み戻す', () => {
    saveDocumentNavHidden(true)

    expect(loadDocumentNavHidden()).toBe(true)
  })

  it('保存が無ければ「隠さない」', () => {
    expect(loadDocumentNavHidden()).toBe(false)
  })

  it('localStorage が使えない環境でも「隠さない」で動く', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage は使えません')
    })

    expect(loadDocumentNavHidden()).toBe(false)
  })
})
