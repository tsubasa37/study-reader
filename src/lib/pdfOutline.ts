import { normalizeSpace } from './textMap'

// pdf.js の getOutline() が返す目次の項目のうち、使う部分
export type OutlineNode = {
  title: string
  dest: string | readonly unknown[] | null
  items: readonly OutlineNode[]
}

export type PdfTocEntry = {
  id: string
  title: string
  depth: number
  pageNumber: number | null
}

// 目次の読み込み具合。失敗したときはパネルに理由を出す
export type OutlineState = { status: 'loading' } | { status: 'ready' } | { status: 'failed'; message: string }

// 目次を文書順に平らに並べ、飛び先のページ番号を添える。飛び先の無い項目（外部リンクなど）は null
export async function flattenOutline(
  nodes: readonly OutlineNode[],
  resolvePageNumber: (dest: string | readonly unknown[]) => Promise<number | null>,
): Promise<PdfTocEntry[]> {
  const entries: PdfTocEntry[] = []
  const visit = async (items: readonly OutlineNode[], depth: number): Promise<void> => {
    for (const item of items) {
      const pageNumber = item.dest === null ? null : await resolvePageNumber(item.dest)
      entries.push({ id: `outline-${entries.length}`, title: normalizeSpace(item.title) || '（無題）', depth, pageNumber })
      await visit(item.items, depth + 1)
    }
  }
  await visit(nodes, 0)
  return entries
}

// 目次の無い PDF は、ページ番号の一覧を目次の代わりにする
export function pageList(pageCount: number): PdfTocEntry[] {
  return Array.from({ length: pageCount }, (_, index) => ({
    id: `page-${index + 1}`,
    title: `p.${index + 1}`,
    depth: 0,
    pageNumber: index + 1,
  }))
}

// 今のページを含む目次の項目 = そのページ以前から始まる項目のうち、文書順で最後のもの
export function tocEntryAt(entries: readonly PdfTocEntry[], pageNumber: number): PdfTocEntry | null {
  let found: PdfTocEntry | null = null
  for (const entry of entries) {
    if (entry.pageNumber !== null && entry.pageNumber <= pageNumber) found = entry
  }
  return found
}

// 続きのカードなどに出す読んでいる場所。目次の見出しがあれば添える
export function pdfPlaceLabel(entry: PdfTocEntry | null, pageNumber: number): string {
  const page = `p.${pageNumber}`
  return entry === null || entry.title === `p.${entry.pageNumber}` ? page : `${entry.title} ・ ${page}`
}
