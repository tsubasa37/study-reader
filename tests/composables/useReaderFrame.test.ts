// @vitest-environment jsdom
import { createApp, defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReaderFrame } from '../../src/composables/useReaderFrame'
import { useStudyStore } from '../../src/composables/useStudyStore'
import { READ_DWELL_MS } from '../../src/lib/position'

const VIEWPORT = 900

type Layout = Record<string, { top: number; height: number }>

// 教材の iframe の代わり。章の位置は決め打ちにし、スクロールは scrollY を動かして scroll を知らせる
function fakeFrame(layout: Layout) {
  const doc = document.implementation.createHTMLDocument('教材')
  doc.body.innerHTML = Object.keys(layout)
    .map((id) => `<section id="${id}"><h2>${id}</h2><p>本文</p></section>`)
    .join('')
  const listeners = new Set<() => void>()
  const win = {
    scrollY: 0,
    innerHeight: VIEWPORT,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'scroll') listeners.add(listener)
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'scroll') listeners.delete(listener)
    },
    scrollTo: ({ top }: { top: number }) => {
      win.scrollY = top
      for (const listener of listeners) listener()
    },
    getComputedStyle: () => ({ scrollPaddingTop: '0px', scrollMarginTop: '0px' }),
  }
  for (const [id, box] of Object.entries(layout)) {
    const element = doc.getElementById(id)
    if (element === null) throw new Error(`章が作れていません: ${id}`)
    element.getBoundingClientRect = () => ({ top: box.top - win.scrollY, height: box.height }) as DOMRect
  }
  const bottom = Math.max(...Object.values(layout).map((box) => box.top + box.height))
  Object.defineProperty(doc.documentElement, 'scrollHeight', { value: bottom })
  Object.defineProperty(doc, 'fonts', { value: { ready: Promise.resolve() } })

  // 利用者が自分でスクロールし、間引きの待ち時間が過ぎたところまで進める
  const userScroll = (top: number) => {
    win.scrollTo({ top })
    vi.advanceTimersByTime(200)
  }
  return { win: win as unknown as Window, doc, userScroll }
}

let unmount: (() => void) | null = null

async function openFrame(layout: Layout) {
  const frame = fakeFrame(layout)
  let reader: ReturnType<typeof useReaderFrame> | null = null
  const app = createApp(
    defineComponent({
      setup() {
        reader = useReaderFrame('教材.html')
        return () => h('div')
      },
    }),
  )
  app.mount(document.createElement('div'))
  unmount = () => app.unmount()
  if (reader === null) throw new Error('useReaderFrame を用意できませんでした')
  const opened: ReturnType<typeof useReaderFrame> = reader
  await opened.open(frame.win, frame.doc)
  opened.markOpened()
  return { reader: opened, userScroll: frame.userScroll }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) =>
      Response.json(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')),
    ),
  )
  const store = useStudyStore()
  store.state.progress = {}
})

afterEach(() => {
  unmount?.()
  unmount = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('読んだ章に自動でチェックを付ける', () => {
  it('短い章（部の扉）も、画面に見えている間に読み進めれば既読になる', async () => {
    const { reader, userScroll } = await openFrame({
      ch0: { top: 0, height: 2000 },
      part1: { top: 2040, height: 250 },
      ch1: { top: 2330, height: 3670 },
    })

    for (const top of [1300, 1500, 1700, 1900, 2100, 2300, 2500]) {
      userScroll(top)
      vi.advanceTimersByTime(2800)
    }

    expect(reader.readSectionIds.value).toContain('part1')
  })

  it('スクロールせずに読み続けても、しばらくたてば見えている章が既読になる', async () => {
    const { reader } = await openFrame({
      ch0: { top: 0, height: 600 },
      ch1: { top: 640, height: 3000 },
    })

    vi.advanceTimersByTime(READ_DWELL_MS + 1000)

    expect(reader.readSectionIds.value).toEqual(['ch0'])
  })

  it('目次から飛んだ先で読み続けると既読になり、飛び越えた章は既読にしない', async () => {
    const { reader } = await openFrame({
      ch0: { top: 0, height: 600 },
      ch1: { top: 640, height: 3000 },
      ch2: { top: 3680, height: 600 },
      ch3: { top: 4320, height: 3000 },
    })
    vi.advanceTimersByTime(1000)

    reader.goToSection('ch2')
    vi.advanceTimersByTime(READ_DWELL_MS + 1000)

    expect(reader.readSectionIds.value).toEqual(['ch2'])
  })

  it('勢いよくスクロールして一瞬見えただけの章は既読にしない', async () => {
    const { reader, userScroll } = await openFrame({
      ch0: { top: 0, height: 600 },
      ch1: { top: 640, height: 3000 },
      ch2: { top: 3680, height: 600 },
      ch3: { top: 4320, height: 4680 },
    })

    for (const top of [1000, 2000, 3000, 4000, 5000]) userScroll(top)
    vi.advanceTimersByTime(READ_DWELL_MS + 1000)

    expect(reader.readSectionIds.value).toEqual([])
  })
})
