import { normalizeSpace } from './textMap'

export type DocSection = {
  id: string
  title: string
  depth: number
  isLeaf: boolean
  element: HTMLElement
}

const SECTION_SELECTOR = 'section[id]'

function depthOf(element: Element): number {
  let depth = 0
  for (let parent = element.parentElement?.closest(SECTION_SELECTOR); parent; parent = parent.parentElement?.closest(SECTION_SELECTOR)) {
    depth++
  }
  return depth
}

function titleOf(element: Element): string {
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6')
  const title = normalizeSpace(heading?.textContent ?? '')
  return title === '' ? element.id : title
}

// 教材の章 = id 付きの section。入れ子（部 > 章）も文書順に並べる
export function detectSections(doc: Document): DocSection[] {
  const seen = new Set<string>()
  const sections: DocSection[] = []
  for (const element of doc.querySelectorAll<HTMLElement>(SECTION_SELECTOR)) {
    if (seen.has(element.id)) continue
    seen.add(element.id)
    sections.push({
      id: element.id,
      title: titleOf(element),
      depth: depthOf(element),
      isLeaf: element.querySelector(SECTION_SELECTOR) === null,
      element,
    })
  }
  return sections
}

export function sectionContaining(sections: readonly DocSection[], node: Node): DocSection | null {
  let found: DocSection | null = null
  for (const section of sections) {
    if (section.element.contains(node)) found = section
  }
  return found
}
