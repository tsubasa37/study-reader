// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { boundaryToIndex, buildTextMap, elementSpan, indexesToRange } from '../../src/lib/textMap'
import { parseHtml } from './helpers'

describe('buildTextMap', () => {
  it('空白の連続を1つにまとめ、ブロックの境目に空白を1つ入れる', () => {
    const doc = parseHtml('<h2>第4章</h2>\n  <p>型で  データを\n説明する</p><p>次<b>の</b>章</p>')

    expect(buildTextMap(doc.body).text).toBe('第4章 型で データを 説明する 次の章')
  })

  it('スクリプト・目次・ボタンの文字は本文に含めない', () => {
    const doc = parseHtml('<nav>目次</nav><p>本文<script>var x = 1</script>です</p><button>コピー</button>')

    expect(buildTextMap(doc.body).text).toBe('本文です')
  })
})

describe('boundaryToIndex', () => {
  it('テキストの中の境界を、まとめた後の本文の位置にする', () => {
    const doc = parseHtml('<p>ab  cd</p>')
    const map = buildTextMap(doc.body)
    const text = doc.querySelector('p')?.firstChild as Text

    expect(boundaryToIndex(map, text, 4)).toBe(3)
  })

  it('要素の境界は、その後に来る最初の文字の位置にする', () => {
    const doc = parseHtml('<p>前</p><p>後</p>')
    const map = buildTextMap(doc.body)

    expect(boundaryToIndex(map, doc.body, 1)).toBe(map.text.indexOf('後'))
  })

  it('教材の目次の中は本文ではないので null', () => {
    const doc = parseHtml('<nav><a href="#a">目次</a></nav><p>本文</p>')
    const map = buildTextMap(doc.body)

    expect(boundaryToIndex(map, doc.querySelector('a')?.firstChild as Text, 0)).toBeNull()
  })
})

describe('indexesToRange', () => {
  it('本文の範囲から、元の DOM を指す Range を作る', () => {
    const doc = parseHtml('<p>型で <b>データ</b>を説明</p>')
    const map = buildTextMap(doc.body)
    const start = map.text.indexOf('データを')

    expect(indexesToRange(map, start, start + 4, doc).toString()).toBe('データを')
  })

  it('範囲が正しくなければ失敗する', () => {
    const doc = parseHtml('<p>abc</p>')
    const map = buildTextMap(doc.body)

    expect(() => indexesToRange(map, 2, 2, doc)).toThrow(RangeError)
  })
})

describe('elementSpan', () => {
  it('要素が本文のどこからどこまでかを返す', () => {
    const doc = parseHtml('<section id="a"><h2>一</h2><p>いち</p></section><section id="b"><h2>二</h2></section>')
    const map = buildTextMap(doc.body)
    const span = elementSpan(map, doc.getElementById('a') as Element)

    expect(map.text.slice(span?.start, span?.end).trim()).toBe('一 いち')
  })
})
