export const HIGHLIGHT_COLORS = ['yellow', 'green', 'pink', 'blue'] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: '黄',
  green: '緑',
  pink: '桃',
  blue: '青',
}
