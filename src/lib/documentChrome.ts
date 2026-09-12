const STYLE_ID = 'study-reader-hide-doc-nav'
const STORAGE_KEY = 'study-reader:hide-doc-nav'

// 教材が自前で持つ目次（nav）を、教材のファイルを書き換えずに隠す。
// 隠すだけでは本文が広がらない教材があるので、目次のために空けてある余白と列も詰める
const HIDE_CSS = `
nav { display: none !important; }
main { margin-left: 0 !important; }
:has(> nav) { grid-template-columns: minmax(0, 1fr) !important; }
`

export function applyDocumentNavHidden(doc: Document, hidden: boolean): void {
  const existing = doc.getElementById(STYLE_ID)
  if (!hidden) {
    existing?.remove()
    return
  }
  if (existing !== null) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = HIDE_CSS
  doc.head.append(style)
}

// 表示の好みはこのブラウザだけのもの。読めない・書けない環境でも教材は開ける
export function loadDocumentNavHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function saveDocumentNavHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0')
  } catch {
    // 覚えられなくても、この画面では切り替わる
  }
}
