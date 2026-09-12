import type { TextQuote } from '../../shared/types'
import { boundaryToIndex, type TextMap } from './textMap'

const CONTEXT_LENGTH = 32
// 同じ文章が複数あるときに、前後がこれだけ一致しなければ「見失った」とする
const MIN_CONTEXT_MATCH = 4

export type TextSpan = { start: number; end: number }

export function quoteFromIndexes(text: string, rawStart: number, rawEnd: number): TextQuote | null {
  let start = rawStart
  let end = rawEnd
  while (start < end && text[start] === ' ') start++
  while (end > start && text[end - 1] === ' ') end--
  if (start >= end) return null
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH),
    start,
  }
}

export function quoteFromRange(map: TextMap, range: Range): TextQuote | null {
  const start = boundaryToIndex(map, range.startContainer, range.startOffset)
  const end = boundaryToIndex(map, range.endContainer, range.endOffset)
  if (start === null || end === null) return null
  return quoteFromIndexes(map.text, start, end)
}

function sharedSuffixLength(a: string, b: string): number {
  let length = 0
  while (length < a.length && length < b.length && a[a.length - 1 - length] === b[b.length - 1 - length]) length++
  return length
}

function sharedPrefixLength(a: string, b: string): number {
  let length = 0
  while (length < a.length && length < b.length && a[length] === b[length]) length++
  return length
}

// 同じ文章が複数あれば、前後の文字の一致数で選び、同点なら保存時の位置に近い方を選ぶ
export function locateQuote(text: string, quote: TextQuote): TextSpan | null {
  let best: number | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  let bestContext = 0
  let candidates = 0
  for (let index = text.indexOf(quote.exact); index !== -1; index = text.indexOf(quote.exact, index + 1)) {
    candidates++
    const before = text.slice(Math.max(0, index - quote.prefix.length), index)
    const afterStart = index + quote.exact.length
    const after = text.slice(afterStart, afterStart + quote.suffix.length)
    const context = sharedSuffixLength(before, quote.prefix) + sharedPrefixLength(after, quote.suffix)
    const score = context - Math.abs(index - quote.start) / (text.length + 1)
    if (score > bestScore) {
      bestScore = score
      bestContext = context
      best = index
    }
  }
  if (best === null) return null
  // 候補が1つだけなら前後が変わっていても採る。複数あるときは前後の一致で決める
  const required = Math.min(quote.prefix.length + quote.suffix.length, MIN_CONTEXT_MATCH)
  if (candidates > 1 && bestContext < required) return null
  return { start: best, end: best + quote.exact.length }
}
