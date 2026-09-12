import type { DocumentProgress } from '../../shared/types'

export type ProgressSummary = {
  ratio: number
  label: string
  started: boolean
}

export function summarizeProgress(progress: DocumentProgress | undefined): ProgressSummary {
  if (progress === undefined) return { ratio: 0, label: '未読', started: false }
  const total = progress.sectionCount
  if (total === 0) {
    const ratio = progress.position.scrollRatio
    return { ratio, label: `${Math.round(ratio * 100)}%`, started: true }
  }
  const read = Math.min(progress.readSectionIds.length, total)
  return { ratio: read / total, label: read === total ? '読了' : `${read} / ${total} 章`, started: true }
}
