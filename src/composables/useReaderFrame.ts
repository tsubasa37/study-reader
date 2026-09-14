import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { DocumentProgress, ReadingPosition } from '../../shared/types'
import { DwellTracker } from '../lib/dwell'
import {
  READ_DWELL_MS,
  finishedSectionIds,
  positionAt,
  scrollTopFor,
  visibleSectionIds,
  type SectionBox,
} from '../lib/position'
import { detectSections } from '../lib/sections'
import { buildTextMap, type TextMap } from '../lib/textMap'
import type { ReaderSession } from '../types/ui'
import { reportError } from './useNotices'
import { useStudyStore } from './useStudyStore'

const SCROLL_THROTTLE_MS = 150
const SAVE_DELAY_MS = 1200
// 自分で動かしたスクロールでは「読み終えた章」を付けない
const PROGRAMMATIC_SCROLL_MS = 800
// スクロールが止まったあと、滞在時間がたまったころにもう一度だけ既読を確かめる
const SETTLE_MS = READ_DWELL_MS + 100

const pixels = (value: string) => Number.parseFloat(value) || 0

export function useReaderFrame(path: string) {
  const store = useStudyStore()
  const session = shallowRef<ReaderSession | null>(null)
  const position = ref<ReadingPosition | null>(null)
  // 記録に残す既読（今の教材に無い章も保持する。教材の書き換えで既読を失わないため）
  const readSectionIds = ref<string[]>([])
  let generation = 0
  let throttleTimer: ReturnType<typeof setTimeout> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let programmaticUntil = 0
  let detach: (() => void) | null = null
  // 章ごとの滞在時間。通り過ぎただけの章を既読にしないために測る
  const dwell = new DwellTracker()

  // 画面に出す既読は、今の教材にある章だけ
  const readInDocument = computed(() => {
    const leaves = session.value?.leafIds
    return leaves === undefined ? [] : readSectionIds.value.filter((id) => leaves.has(id))
  })

  const currentSection = computed(() => {
    const id = position.value?.sectionId
    return session.value?.sections.find((section) => section.id === id) ?? null
  })

  function measure({ win, sections }: ReaderSession): SectionBox[] {
    return sections.map((section) => {
      const rect = section.element.getBoundingClientRect()
      return { id: section.id, top: rect.top + win.scrollY, height: rect.height }
    })
  }

  const maxScroll = ({ win, doc }: ReaderSession) => Math.max(0, doc.documentElement.scrollHeight - win.innerHeight)

  function update(markFinished: boolean): void {
    const current = session.value
    if (current === null) return
    const scrollTop = current.win.scrollY
    const boxes = measure(current)
    position.value = positionAt(boxes, scrollTop, maxScroll(current))
    const leaves = boxes.filter((box) => current.leafIds.has(box.id))
    // 読んでいる線の章だけでなく、画面に見えている章すべての滞在を数える（短い章や最後の章も既読にできるように）
    const totals = dwell.move(visibleSectionIds(leaves, scrollTop, current.win.innerHeight), Date.now())
    if (!markFinished) return
    const added = finishedSectionIds(leaves, scrollTop, current.win.innerHeight, totals).filter(
      (id) => !readSectionIds.value.includes(id),
    )
    if (added.length > 0) readSectionIds.value = [...readSectionIds.value, ...added]
  }

  function progressEntry(): DocumentProgress | null {
    const current = session.value
    if (current === null || position.value === null) return null
    // 章が1つも取れない教材で、章のあった記録を上書きしない（読み込みに失敗した可能性がある）
    if (current.leafIds.size === 0 && (store.state.progress[path]?.sectionCount ?? 0) > 0) return null
    return {
      path,
      lastOpenedAt: new Date().toISOString(),
      position: position.value,
      sectionTitle: currentSection.value?.title ?? null,
      readSectionIds: [...readSectionIds.value],
      sectionCount: current.leafIds.size,
    }
  }

  function saveNow(keepalive = false): void {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = null
    const entry = progressEntry()
    if (entry !== null) store.saveProgress(entry, keepalive).catch(reportError)
  }

  function scheduleSave(): void {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveNow(), SAVE_DELAY_MS)
  }

  // スクロールせずに読み続けていても、滞在時間がたまった時点で既読を付ける
  function scheduleSettle(): void {
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = null
      if (document.visibilityState === 'hidden') return
      const before = readSectionIds.value.length
      update(true)
      if (readSectionIds.value.length !== before) scheduleSave()
    }, SETTLE_MS)
  }

  function onScroll(): void {
    if (throttleTimer !== null) return
    throttleTimer = setTimeout(() => {
      throttleTimer = null
      update(Date.now() >= programmaticUntil)
      scheduleSave()
      scheduleSettle()
    }, SCROLL_THROTTLE_MS)
  }

  // 読み込みが重なったとき、古い方の続きで新しい方を壊さないよう世代で見分ける
  async function open(win: Window, doc: Document): Promise<ReaderSession | null> {
    const mine = ++generation
    detach?.()
    detach = null
    await doc.fonts.ready
    if (mine !== generation) return null
    const sections = detectSections(doc)
    let map: TextMap | null = null
    const opened: ReaderSession = {
      win,
      doc,
      sections,
      leafIds: new Set(sections.filter((section) => section.isLeaf).map((section) => section.id)),
      textMap: () => (map ??= buildTextMap(doc.body)),
    }
    readSectionIds.value = [...(store.state.progress[path]?.readSectionIds ?? [])]
    dwell.start(Date.now())
    session.value = opened

    const onPageHide = () => saveNow(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // 見ていない間は滞在時間を数えない
        dwell.pause(Date.now())
        saveNow(true)
        return
      }
      dwell.resume(Date.now())
      scheduleSettle()
    }
    win.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    detach = () => {
      win.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (throttleTimer !== null) clearTimeout(throttleTimer)
      throttleTimer = null
      if (settleTimer !== null) clearTimeout(settleTimer)
      settleTimer = null
    }
    return opened
  }

  function scrollToTop(top: number): void {
    const current = session.value
    if (current === null) return
    programmaticUntil = Date.now() + PROGRAMMATIC_SCROLL_MS
    current.win.scrollTo({ top, behavior: 'instant' })
    update(false)
    scheduleSave()
    scheduleSettle()
  }

  function goToPosition(target: ReadingPosition): boolean {
    const current = session.value
    if (current === null) return false
    const { top, sectionFound } = scrollTopFor(measure(current), target, maxScroll(current))
    scrollToTop(top)
    return sectionFound
  }

  function goToSection(id: string): void {
    const current = session.value
    const section = current?.sections.find((candidate) => candidate.id === id)
    if (current === null || section === undefined) throw new Error(`章が見つかりません: ${id}`)
    const style = current.win.getComputedStyle(current.doc.documentElement)
    const margin = pixels(current.win.getComputedStyle(section.element).scrollMarginTop)
    const top = section.element.getBoundingClientRect().top + current.win.scrollY
    scrollToTop(top - pixels(style.scrollPaddingTop) - margin)
  }

  function goToRange(range: Range): void {
    const current = session.value
    if (current === null) return
    for (let element = range.startContainer.parentElement; element !== null; element = element.parentElement) {
      if (element.localName === 'details') (element as HTMLDetailsElement).open = true
    }
    const rect = range.getBoundingClientRect()
    scrollToTop(current.win.scrollY + rect.top - current.win.innerHeight * 0.3)
  }

  function setRead(id: string, read: boolean): void {
    readSectionIds.value = read
      ? [...new Set([...readSectionIds.value, id])]
      : readSectionIds.value.filter((candidate) => candidate !== id)
    saveNow()
  }

  function capturePosition(): ReadingPosition {
    update(false)
    if (position.value === null) throw new Error('読んでいる位置を取得できませんでした')
    return position.value
  }

  function markOpened(): void {
    update(false)
    saveNow()
    scheduleSettle()
  }

  onBeforeUnmount(() => {
    saveNow()
    detach?.()
  })

  return {
    session,
    position,
    currentSection,
    readSectionIds,
    readInDocument,
    open,
    goToPosition,
    goToSection,
    goToRange,
    setRead,
    capturePosition,
    markOpened,
  }
}
