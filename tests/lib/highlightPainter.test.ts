// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { HIGHLIGHT_COLORS } from '../../shared/constants'
import { installHighlightStyles, paintHighlights, swatchBackground } from '../../src/lib/highlightPainter'
import { parseHtml } from './helpers'

class FakeHighlight {
  readonly ranges: Range[]
  constructor(...ranges: Range[]) {
    this.ranges = ranges
  }
}

function fakeWindow() {
  const registry = new Map<string, FakeHighlight>()
  const win = { CSS: { highlights: registry }, Highlight: FakeHighlight } as unknown as Window
  return { win, registry }
}

const rangeIn = (text: string): Range => {
  const doc = parseHtml(`<p>${text}</p>`)
  const range = doc.createRange()
  range.selectNodeContents(doc.querySelector('p') as Element)
  return range
}

describe('paintHighlights', () => {
  it('色ごとに分けて塗る', () => {
    const { win, registry } = fakeWindow()
    const yellow = rangeIn('黄色にする文')

    paintHighlights(win, [{ color: 'yellow', range: yellow }])

    expect(registry.get('study-yellow')?.ranges).toEqual([yellow])
  })

  it('使っていない色は空にして、前に塗った色を消す', () => {
    const { win, registry } = fakeWindow()

    paintHighlights(win, [{ color: 'green', range: rangeIn('緑の文') }])

    for (const color of HIGHLIGHT_COLORS) {
      expect(registry.has(`study-${color}`)).toBe(true)
    }
    expect(registry.get('study-pink')?.ranges).toEqual([])
  })

  it('対応していないブラウザでは、その旨を伝えて止まる', () => {
    expect(() => paintHighlights({} as Window, [])).toThrow('このブラウザはハイライト表示に対応していません')
  })
})

describe('installHighlightStyles', () => {
  it('教材に色の指定を1つだけ足す', () => {
    const doc = parseHtml('<p>本文</p>')

    installHighlightStyles(doc)
    installHighlightStyles(doc)

    const styles = doc.querySelectorAll('#study-reader-highlight-style')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain('::highlight(study-yellow)')
  })
})

describe('swatchBackground', () => {
  it('色見本は白を下に敷く（暗い画面でも蛍光ペンの色に見せる）', () => {
    expect(swatchBackground('yellow')).toContain('#ffffff')
  })
})
