import type { ReaderSession } from '../types/ui'
import { isSearchShortcut } from './shortcuts'
import { normalizeSpace } from './textMap'

export type FrameHandlers = {
  openDocument: (path: string) => void
  openSearch: () => void
  escape: () => void
  popupBlocked: (url: string) => void
}

const EXCERPT_BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, pre, dd, dt, td, th, figcaption, blockquote, summary'
const EXCERPT_LENGTH = 80

export function decodeVaultPath(pathname: string): string {
  return pathname
    .slice('/vault/'.length)
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

// 教材のリンクで iframe が別ページへ移ると読書の記録が途切れるので、外部リンクは別タブ、別の教材は閲覧画面で開く
export function attachFrameInteractions({ doc }: ReaderSession, handlers: FrameHandlers): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null | undefined
    if (anchor == null) return
    const url = new URL(anchor.href)
    const sameOrigin = url.origin === window.location.origin
    if (sameOrigin && url.pathname === doc.location.pathname) return
    event.preventDefault()
    if (sameOrigin && url.pathname.startsWith('/vault/')) {
      handlers.openDocument(decodeVaultPath(url.pathname))
      return
    }
    const opened = window.open(url.href, '_blank', 'noopener,noreferrer')
    if (opened === null) handlers.popupBlocked(url.href)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (isSearchShortcut(event)) {
      event.preventDefault()
      handlers.openSearch()
      return
    }
    if (event.key === 'Escape') handlers.escape()
  }
  doc.addEventListener('click', onClick)
  doc.addEventListener('keydown', onKeyDown)
  return () => {
    doc.removeEventListener('click', onClick)
    doc.removeEventListener('keydown', onKeyDown)
  }
}

export function excerptAtTop({ doc, win }: ReaderSession): string {
  const element = doc.elementFromPoint(win.innerWidth * 0.6, win.innerHeight * 0.2)
  if (element === null || element.closest('nav') !== null) return ''
  const block = element.closest(EXCERPT_BLOCKS) ?? element
  return normalizeSpace(block.textContent ?? '').slice(0, EXCERPT_LENGTH)
}
