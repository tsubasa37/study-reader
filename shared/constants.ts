export const HIGHLIGHT_COLORS = ['yellow', 'green', 'pink', 'blue'] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export const HIGHLIGHT_COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: '黄',
  green: '緑',
  pink: '桃',
  blue: '青',
}

// 色が表す意味の初期値。利用者が .study/settings.json に名前を付け直せる
export const DEFAULT_HIGHLIGHT_COLOR_NAMES: Record<HighlightColor, string> = {
  yellow: '大事',
  green: 'わかった',
  pink: '疑問',
  blue: 'あとで調べる',
}

export const HIGHLIGHT_COLOR_NAME_MAX = 20
