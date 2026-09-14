import { HIGHLIGHT_COLOR_LABELS, type HighlightColor } from '../../shared/constants'
import type { HighlightColorNames } from '../../shared/types'

// 画面に出す決まり文句。同じ言い回しを1か所にまとめる
export const NO_SECTION = '章の区切りなし'
export const NO_EXCERPT = '（本文の抜き出しなし）'
export const VAULT_ROOT = '資料フォルダの直下'

// 色の名前に、どの色かを添える（例: 大事（黄））
export const colorTitle = (names: HighlightColorNames, color: HighlightColor): string =>
  `${names[color]}（${HIGHLIGHT_COLOR_LABELS[color]}）`
