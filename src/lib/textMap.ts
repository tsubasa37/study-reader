const TEXT_NODE = 3
const ELEMENT_NODE = 1

// 本文として扱わない要素（教材自身の目次・操作部品・スクリプト）
const SKIPPED_ELEMENTS = new Set(['script', 'style', 'noscript', 'template', 'nav', 'svg', 'iframe', 'textarea', 'select', 'button'])
export const SKIPPED_SELECTOR = [...SKIPPED_ELEMENTS].join(',')

const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup',
  'hr', 'li', 'main', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'tr', 'ul',
])

const WHITESPACE = /\s/

export type TextMap = {
  readonly text: string
  readonly nodes: readonly Text[]
  readonly nodeIndexOf: ReadonlyMap<Text, number>
  readonly charNode: Int32Array
  readonly charOffset: Int32Array
}

export function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

// 空白の連続を1つにまとめ、ブロック要素の境目に空白を1つ挟んだ本文と、各文字の元の位置を作る
export function buildTextMap(root: Node): TextMap {
  const nodes: Text[] = []
  const chars: string[] = []
  const charNode: number[] = []
  const charOffset: number[] = []
  let last = ''
  let pendingBreak = false

  const emit = (char: string, node: number, offset: number) => {
    chars.push(char)
    charNode.push(node)
    charOffset.push(offset)
    last = char
  }

  const visit = (node: Node): void => {
    if (node.nodeType === TEXT_NODE) {
      const data = (node as Text).data
      if (data.length === 0) return
      const index = nodes.push(node as Text) - 1
      for (let offset = 0; offset < data.length; offset++) {
        const char = data[offset] as string
        const isSpace = WHITESPACE.test(char)
        if (isSpace || pendingBreak) {
          if (last !== '' && last !== ' ') emit(' ', index, offset)
          if (isSpace) continue
          pendingBreak = false
        }
        emit(char, index, offset)
      }
      return
    }
    if (node.nodeType === ELEMENT_NODE) {
      const name = (node as Element).localName
      if (SKIPPED_ELEMENTS.has(name)) return
      const isBlock = BLOCK_ELEMENTS.has(name)
      if (isBlock) pendingBreak = true
      node.childNodes.forEach(visit)
      if (isBlock) pendingBreak = true
      return
    }
    node.childNodes.forEach(visit)
  }

  visit(root)

  return {
    text: chars.join(''),
    nodes,
    nodeIndexOf: new Map(nodes.map((node, index) => [node, index])),
    charNode: Int32Array.from(charNode),
    charOffset: Int32Array.from(charOffset),
  }
}

function firstCharAtOrAfter(map: TextMap, node: number, offset: number): number {
  let low = 0
  let high = map.text.length
  while (low < high) {
    const middle = (low + high) >> 1
    const middleNode = map.charNode[middle] as number
    const before = middleNode < node || (middleNode === node && (map.charOffset[middle] as number) < offset)
    if (before) low = middle + 1
    else high = middle
  }
  // ブロックの境目に足した空白は次の文字と同じ位置を指すので、その文字の方を返す
  const sharesNextPosition =
    map.text[low] === ' ' &&
    map.charNode[low] === map.charNode[low + 1] &&
    map.charOffset[low] === map.charOffset[low + 1]
  return sharesNextPosition ? low + 1 : low
}

// DOM の境界（コンテナ＋オフセット）を本文の文字位置に変える。本文外（目次など）なら null
export function boundaryToIndex(map: TextMap, container: Node, offset: number): number | null {
  if (container.nodeType === TEXT_NODE) {
    const index = map.nodeIndexOf.get(container as Text)
    if (index !== undefined) return firstCharAtOrAfter(map, index, offset)
  }
  const element = container.nodeType === ELEMENT_NODE ? (container as Element) : container.parentElement
  if (element?.closest(SKIPPED_SELECTOR)) return null

  const doc = container.ownerDocument ?? (container as Document)
  const point = doc.createRange()
  point.setStart(container, offset)
  let low = 0
  let high = map.nodes.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (point.comparePoint(map.nodes[middle] as Text, 0) < 0) low = middle + 1
    else high = middle
  }
  return firstCharAtOrAfter(map, low, 0)
}

export function indexesToRange(map: TextMap, start: number, end: number, doc: Document): Range {
  if (start < 0 || end > map.text.length || start >= end) {
    throw new RangeError(`本文の範囲が正しくありません: ${start}〜${end}`)
  }
  const range = doc.createRange()
  range.setStart(map.nodes[map.charNode[start] as number] as Text, map.charOffset[start] as number)
  const lastChar = end - 1
  range.setEnd(map.nodes[map.charNode[lastChar] as number] as Text, (map.charOffset[lastChar] as number) + 1)
  return range
}

export function elementSpan(map: TextMap, element: Element): { start: number; end: number } | null {
  const start = boundaryToIndex(map, element, 0)
  const end = boundaryToIndex(map, element, element.childNodes.length)
  if (start === null || end === null) return null
  return { start, end }
}
