import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { DocumentProgress, ReadingPosition } from '../../shared/types'
import { finishedSectionIds, positionAt, scrollTopFor, type SectionBox } from '../lib/position'
import { detectSections } from '../lib/sections'
import { buildTextMap, type TextMap } from '../lib/textMap'
import type { ReaderSession } from '../types/ui'
import { reportError } from './useNotices'
import { useStudyStore } from './useStudyStore'

const SCROLL_THROTTLE_MS = 150
const SAVE_DELAY_MS = 1200
// 自分で動かしたスクロールでは「読み終えた章」を付けない
const PROGRAMMATIC_SCROLL_MS = 800

const pixels = (value: string) => Number.parseFloat(value) || 0

export function useReaderFrame(path: string) {
  const store = useStudyStore()
  const session = shallowRef<ReaderSession | null>(null)
  const position = ref<ReadingPosition | null>(null)
  const readSectionIds = ref<string[]>([])
  let throttleTimer: ReturnType<typeof setTimeout> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let programmaticUntil = 0
  let detach: (() => void) | null = null
  // 章ごとの滞在時間。通り過ぎただけの章を既読にしないために測る
  let dwellMs = new Map<string, number>()
  let dwellSectionId: string | null = null
  let dwellSince = 0

  function accumulateDwell(sectionId: string | null, now: number): Map<string, number> {
    if (dwellSectionId !== null) {
      dwellMs.set(dwellSectionId, (dwellMs.get(dwellSectionId) ?? 0) + (now - dwellSince))
    }
    dwellSectionId = sectionId
    dwellSince = now
    return dwellMs
  }

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
    const dwell = accumulateDwell(position.value.sectionId, Date.now())
    if (!markFinished) return
    const leaves = boxes.filter((box) => current.leafIds.has(box.id))
    const added = finishedSectionIds(leaves, scrollTop, current.win.innerHeight, dwell).filter(
      (id) => !readSectionIds.value.includes(id),
    )
    if (added.length > 0) readSectionIds.value = [...readSectionIds.value, ...added]
  }

  function progressEntry(): DocumentProgress | null {
    const current = session.value
    if (current === null || position.value === null) return null
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

  function onScroll(): void {
    if (throttleTimer !== null) return
    throttleTimer = setTimeout(() => {
      throttleTimer = null
      update(Date.now() >= programmaticUntil)
      scheduleSave()
    }, SCROLL_THROTTLE_MS)
  }

  async function open(win: Window, doc: Document): Promise<ReaderSession> {
    detach?.()
    await doc.fonts.ready
    const sections = detectSections(doc)
    let map: TextMap | null = null
    const opened: ReaderSession = {
      win,
      doc,
      sections,
      leafIds: new Set(sections.filter((section) => section.isLeaf).map((section) => section.id)),
      textMap: () => (map ??= buildTextMap(doc.body)),
    }
    readSectionIds.value = (store.state.progress[path]?.readSectionIds ?? []).filter((id) => opened.leafIds.has(id))
    dwellMs = new Map()
    dwellSectionId = null
    dwellSince = Date.now()
    session.value = opened

    const onPageHide = () => saveNow(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveNow(true)
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
    open,
    goToPosition,
    goToSection,
    goToRange,
    setRead,
    capturePosition,
    markOpened,
  }
}
