// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachFrameInteractions, decodeVaultPath } from '../../src/lib/frameInteractions'
import type { ReaderSession } from '../../src/types/ui'

describe('decodeVaultPath', () => {
  it('教材のリンク先 URL を資料フォルダ内のパスに戻す', () => {
    expect(decodeVaultPath(`/vault/sub/${encodeURIComponent('Ansible・CI基礎教科書.html')}`)).toBe(
      'sub/Ansible・CI基礎教科書.html',
    )
  })
})

describe('教材の中のリンク', () => {
  let detach: (() => void) | null = null

  afterEach(() => {
    detach?.()
    detach = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  function setup(html: string) {
    document.body.innerHTML = html
    const handlers = {
      openDocument: vi.fn(),
      openSearch: vi.fn(),
      escape: vi.fn(),
      popupBlocked: vi.fn(),
    }
    const open = vi.spyOn(window, 'open').mockReturnValue(window)
    detach = attachFrameInteractions({ doc: document } as unknown as ReaderSession, handlers)
    const click = () => {
      const anchor = document.querySelector('a') as HTMLAnchorElement
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      anchor.dispatchEvent(event)
      return event
    }
    return { handlers, open, click }
  }

  it('別の教材（HTML）は閲覧画面で開く', () => {
    const { handlers, open, click } = setup('<a href="/vault/sub/%E6%95%99%E6%9D%90.html">別の教材</a>')

    const event = click()

    expect(handlers.openDocument).toHaveBeenCalledWith('sub/教材.html')
    expect(open).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('資料フォルダの PDF は閲覧画面ではなく別タブで開く', () => {
    const { handlers, open, click } = setup('<a href="/vault/%E8%B3%87%E6%96%99.pdf">PDF</a>')

    click()

    expect(handlers.openDocument).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith(expect.stringContaining('/vault/'), '_blank', 'noopener,noreferrer')
  })

  it('外部リンクは別タブで開く', () => {
    const { handlers, open, click } = setup('<a href="https://vuejs.org/guide/">公式</a>')

    click()

    expect(handlers.openDocument).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledWith('https://vuejs.org/guide/', '_blank', 'noopener,noreferrer')
  })

  it('別タブがブラウザに止められたら知らせる', () => {
    const { handlers, open, click } = setup('<a href="https://vuejs.org/guide/">公式</a>')
    open.mockReturnValue(null)

    click()

    expect(handlers.popupBlocked).toHaveBeenCalledWith('https://vuejs.org/guide/')
  })

  it('同じページの中のリンク（目次）はそのまま教材に任せる', () => {
    const { handlers, open, click } = setup('<a href="#ch1">1章へ</a>')

    const event = click()

    expect(handlers.openDocument).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('取り外した後は反応しない', () => {
    const { handlers, click } = setup('<a href="/vault/%E6%95%99%E6%9D%90.html">別の教材</a>')
    detach?.()
    detach = null

    click()

    expect(handlers.openDocument).not.toHaveBeenCalled()
  })
})
