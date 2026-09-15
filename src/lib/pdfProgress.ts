import type { DocumentProgress, ReadingPosition } from '../../shared/types'
import { pdfPlaceLabel, tocEntryAt, type PdfTocEntry } from './pdfOutline'
import { pageNumberOf } from './pdfPosition'

// PDF の進み具合の記録。章の数は持たない（本棚では読んだ位置の割合で出す）
export function pdfProgressEntry(
  path: string,
  position: ReadingPosition,
  outline: readonly PdfTocEntry[],
  previous: DocumentProgress | undefined,
  now: Date,
): DocumentProgress {
  const pageNumber = pageNumberOf(position.sectionId) ?? 1
  return {
    path,
    lastOpenedAt: now.toISOString(),
    position,
    sectionTitle: pdfPlaceLabel(tocEntryAt(outline, pageNumber), pageNumber),
    readSectionIds: [...(previous?.readSectionIds ?? [])],
    sectionCount: 0,
  }
}
