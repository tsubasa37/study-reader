// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { locateQuote } from '../../src/lib/anchoring'
import { foldForSearch, indexDocument, matchesText, searchDocuments } from '../../src/lib/search'
import { parseHtml } from './helpers'

const indexed = indexDocument(
  'TypeScript基礎教科書.html',
  'TypeScript基礎教科書',
  parseHtml(`
    <nav><a href="#t-objects">TypeScript の目次</a></nav>
    <section id="t-objects"><h2>04 オブジェクト・type・interface</h2><p>ＴｙｐｅＳｃｒｉｐｔ では Type を使う。</p></section>
    <section id="t-union"><h2>06 union</h2><p>typescript の union 型。</p></section>
  `),
)

describe('searchDocuments', () => {
  it('全角・半角と大文字・小文字を区別せずに探し、章と前後の文字を添える', () => {
    const hits = searchDocuments([indexed], 'typescript')

    expect(hits.map(({ sectionId, sectionTitle, match }) => ({ sectionId, sectionTitle, match }))).toEqual([
      { sectionId: 't-objects', sectionTitle: '04 オブジェクト・type・interface', match: 'ＴｙｐｅＳｃｒｉｐｔ' },
      { sectionId: 't-union', sectionTitle: '06 union', match: 'typescript' },
    ])
    expect(hits[1]?.after.startsWith(' の union 型。')).toBe(true)
  })

  it('見つけた位置は、閲覧画面で同じ文章として探し直せる', () => {
    for (const hit of searchDocuments([indexed], 'type')) {
      expect(locateQuote(indexed.text, hit.quote)?.start).toBe(hit.quote.start)
    }
  })

  it('教材の目次の文字は検索しない', () => {
    expect(searchDocuments([indexed], 'の目次')).toEqual([])
  })

  it('空白だけの検索語では何も返さない', () => {
    expect(searchDocuments([indexed], '   ')).toEqual([])
  })
})

describe('matchesText', () => {
  it('どれかの欄に、全角・半角と大文字・小文字を区別せず含まれていれば一致', () => {
    expect(matchesText(['交差型は上書きではない', 'Never になる'], 'ｎｅｖｅｒ')).toBe(true)
  })

  it('含まれていなければ不一致、空の検索語も不一致', () => {
    expect(matchesText(['交差型'], 'union')).toBe(false)
    expect(matchesText(['交差型'], ' ')).toBe(false)
  })
})

describe('foldForSearch', () => {
  it('全角英数と大文字は半角小文字にそろえる', () => {
    expect(foldForSearch('ＴｙｐｅScript１')).toBe('typescript1')
  })

  it('NFKC で長さが変わる文字はそのまま残す（本文の位置がずれないため）', () => {
    const text = 'あ…⑩Ａ'

    const folded = foldForSearch(text)

    expect(folded).toBe('あ…⑩a')
    expect(folded.length).toBe(text.length)
  })

  it('… を含む本文でも、見つけた位置がその文字を指す', () => {
    const indexedWithEllipsis = indexDocument(
      '例.html',
      '例',
      parseHtml('<section id="s"><h2>章</h2><p>まず…そしてTypeScriptの話。</p></section>'),
    )

    const [hit] = searchDocuments([indexedWithEllipsis], 'typescript')

    expect(hit).toBeDefined()
    expect(indexedWithEllipsis.text.slice(hit?.quote.start, (hit?.quote.start ?? 0) + 10)).toBe('TypeScript')
  })
})
