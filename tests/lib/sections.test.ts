// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { detectSections, sectionContaining } from '../../src/lib/sections'
import { parseHtml } from './helpers'

const doc = parseHtml(`
  <main>
    <section id="ch0"><h2>この教科書の地図</h2></section>
    <section id="part1"><p class="part-no">PART 1</p><h2>第1部 サーバーの基礎</h2>
      <section id="ch1"><p>第1章</p><h2>サーバーと Linux</h2><section class="quiz"><h3>確認</h3></section></section>
      <section id="ch2"><h2>ユーザーと権限</h2></section>
    </section>
    <section id="glossary"></section>
  </main>
`)

describe('detectSections', () => {
  it('id 付きの section を、入れ子の深さ・末端かどうか・見出しと一緒に文書順で返す', () => {
    expect(detectSections(doc).map(({ id, title, depth, isLeaf }) => ({ id, title, depth, isLeaf }))).toEqual([
      { id: 'ch0', title: 'この教科書の地図', depth: 0, isLeaf: true },
      { id: 'part1', title: '第1部 サーバーの基礎', depth: 0, isLeaf: false },
      { id: 'ch1', title: 'サーバーと Linux', depth: 1, isLeaf: true },
      { id: 'ch2', title: 'ユーザーと権限', depth: 1, isLeaf: true },
      { id: 'glossary', title: 'glossary', depth: 0, isLeaf: true },
    ])
  })
})

describe('sectionContaining', () => {
  it('その位置を含む一番深い章を返す', () => {
    const quizHeading = doc.querySelector('.quiz h3')?.firstChild as Text

    expect(sectionContaining(detectSections(doc), quizHeading)?.id).toBe('ch1')
  })
})
