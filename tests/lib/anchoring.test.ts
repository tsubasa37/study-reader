// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { locateQuote, quoteFromIndexes, quoteFromRange } from '../../src/lib/anchoring'
import { buildTextMap, indexesToRange } from '../../src/lib/textMap'
import { parseHtml } from './helpers'

describe('quoteFromRange', () => {
  it('選んだ文章と、その前後の文字を覚える', () => {
    const doc = parseHtml('<p>オブジェクトの形に名前を付ける方法は2つあります。</p>')
    const text = doc.querySelector('p')?.firstChild as Text
    const range = doc.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 6)

    expect(quoteFromRange(buildTextMap(doc.body), range)).toEqual({
      exact: 'オブジェクト',
      prefix: '',
      suffix: 'の形に名前を付ける方法は2つあります。',
      start: 0,
    })
  })

  it('両端の空白は含めない', () => {
    expect(quoteFromIndexes('前 型で 後', 1, 5)).toMatchObject({ exact: '型で', start: 2 })
  })

  it('空白だけの選択は null', () => {
    expect(quoteFromIndexes('前   後', 1, 2)).toBeNull()
  })
})

describe('locateQuote', () => {
  it('同じ文章が複数あれば、前後の文字が一致する方を選ぶ', () => {
    const text = 'A: never になる。B: never ではない。'
    const second = text.indexOf('never', 5)

    expect(locateQuote(text, { exact: 'never', prefix: 'B: ', suffix: ' ではない', start: 0 })).toEqual({
      start: second,
      end: second + 5,
    })
  })

  it('教材の前の方に段落が増え、空白の入り方が変わっても見つける', () => {
    const before = parseHtml('<p>序文</p><p>交差型は上書きではない。</p>')
    const beforeMap = buildTextMap(before.body)
    const index = beforeMap.text.indexOf('上書き')
    const quote = quoteFromIndexes(beforeMap.text, index, index + 3)
    if (quote === null) throw new Error('quote が作れませんでした')

    const after = parseHtml('<p>序文</p><p>新しく足した段落です。</p><p>交差型は\n    上書きではない。</p>')
    const afterMap = buildTextMap(after.body)
    const span = locateQuote(afterMap.text, quote)
    if (span === null) throw new Error('見つかりませんでした')

    expect(indexesToRange(afterMap, span.start, span.end, after).toString()).toBe('上書き')
  })

  it('文章が消えていれば null', () => {
    expect(locateQuote('書き換えた後の教材', { exact: '上書き', prefix: '', suffix: '', start: 0 })).toBeNull()
  })
})
