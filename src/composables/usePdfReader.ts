import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import type { ReadingPosition } from '../../shared/types'
import { vaultUrl } from '../lib/api'
import { flattenOutline, pageList, tocEntryAt, type OutlineState, type PdfTocEntry } from '../lib/pdfOutline'
import { pageBoxes, pageNumberOf } from '../lib/pdfPosition'
import { pdfProgressEntry } from '../lib/pdfProgress'
import { PDFJS_ASSET_OPTIONS, loadPdfjs, type Pdfjs } from '../lib/pdfjs'
import { positionAt, scrollTopFor, type SectionBox } from '../lib/position'
import { reportError } from './useNotices'
import { useStudyStore } from './useStudyStore'

const SCROLL_THROTTLE_MS = 150
const SAVE_DELAY_MS = 1200

type PdfViewer = InstanceType<Pdfjs['viewer']['PDFViewer']>
type PdfDocument = Awaited<ReturnType<Pdfjs['lib']['getDocument']>['promise']>

export type ZoomAction = 'in' | 'out' | 'fit'

export function usePdfReader(path: string) {
  const store = useStudyStore()
  const loading = ref(true)
  const pageCount = ref(0)
  const scalePercent = ref(100)
  const position = ref<ReadingPosition | null>(null)
  // PDF に入っている目次。ページを表示してから読む
  const outline = shallowRef<PdfTocEntry[]>([])
  const outlineState = shallowRef<OutlineState>({ status: 'loading' })
  // 目次の無い PDF はページの一覧を目次の代わりにする。読み込み中と失敗したときは出さない
  const toc = computed(() => {
    if (outlineState.value.status !== 'ready') return []
    return outline.value.length > 0 ? outline.value : pageList(pageCount.value)
  })
  const pageNumber = computed(() => pageNumberOf(position.value?.sectionId ?? null) ?? 1)
  const currentEntry = computed(() => tocEntryAt(toc.value, pageNumber.value))

  let container: HTMLDivElement | null = null
  let viewer: PdfViewer | null = null
  let pdfDocument: PdfDocument | null = null
  let destroyTask: (() => Promise<void>) | null = null
  let throttleTimer: ReturnType<typeof setTimeout> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let detach: (() => void) | null = null
  let disposed = false

  // 各ページの位置を、スクロールする枠の中の座標で測る
  function measure(): SectionBox[] {
    const frame = container
    const current = viewer
    if (frame === null || current === null) return []
    const originTop = frame.getBoundingClientRect().top - frame.scrollTop
    const pages = Array.from({ length: current.pagesCount }, (_, index) => {
      const rect = (current.getPageView(index).div as HTMLDivElement).getBoundingClientRect()
      return { top: rect.top - originTop, height: rect.height }
    })
    return pageBoxes(pages)
  }

  const maxScroll = (frame: HTMLDivElement) => Math.max(0, frame.scrollHeight - frame.clientHeight)

  function update(): void {
    if (container === null) return
    position.value = positionAt(measure(), container.scrollTop, maxScroll(container))
  }

  function saveNow(keepalive = false): void {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = null
    if (loading.value || position.value === null) return
    const entry = pdfProgressEntry(path, position.value, outline.value, store.state.progress[path], new Date())
    store.saveProgress(entry, keepalive).catch(reportError)
  }

  function scheduleSave(): void {
    if (saveTimer !== null) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveNow(), SAVE_DELAY_MS)
  }

  function onScroll(): void {
    if (throttleTimer !== null) return
    throttleTimer = setTimeout(() => {
      throttleTimer = null
      update()
      scheduleSave()
    }, SCROLL_THROTTLE_MS)
  }

  function goToPosition(target: ReadingPosition): boolean {
    if (container === null) return false
    const { top, sectionFound } = scrollTopFor(measure(), target, maxScroll(container))
    container.scrollTop = top
    update()
    scheduleSave()
    return sectionFound
  }

  function goToPage(target: number): void {
    if (viewer === null) return
    viewer.scrollPageIntoView({ pageNumber: target })
    update()
    scheduleSave()
  }

  // 拡大縮小しても、読んでいたページの同じ辺りを画面に残す
  function zoom(action: ZoomAction): void {
    if (viewer === null || position.value === null) return
    const keep = position.value
    if (action === 'in') viewer.increaseScale()
    else if (action === 'out') viewer.decreaseScale()
    else viewer.currentScaleValue = 'auto'
    scalePercent.value = Math.round(viewer.currentScale * 100)
    goToPosition(keep)
  }

  async function resolvePageNumber(dest: string | readonly unknown[]): Promise<number | null> {
    const doc = pdfDocument
    if (doc === null) throw new Error('PDF を開く前に、目次の飛び先を調べようとしました')
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
    const target: unknown = explicit?.[0]
    if (target === undefined || target === null) return null
    if (typeof target === 'number') return target + 1
    return (await doc.getPageIndex(target as Parameters<PdfDocument['getPageIndex']>[0])) + 1
  }

  // PDF を表示し、前回の続きの位置に戻す。前回のページが今の PDF に無ければ false。目次は loadOutline で後から読む
  async function open(frame: HTMLDivElement, pagesElement: HTMLDivElement): Promise<boolean> {
    const pdfjs = await loadPdfjs()
    if (disposed) return true
    const eventBus = new pdfjs.viewer.EventBus()
    const linkService = new pdfjs.viewer.PDFLinkService({ eventBus, externalLinkTarget: pdfjs.viewer.LinkTarget.BLANK })
    const current = new pdfjs.viewer.PDFViewer({
      container: frame,
      viewer: pagesElement,
      eventBus,
      linkService,
      removePageBorders: true,
      annotationMode: pdfjs.lib.AnnotationMode.ENABLE,
    })
    linkService.setViewer(current)
    container = frame
    viewer = current

    const task = pdfjs.lib.getDocument({ url: vaultUrl(path), ...PDFJS_ASSET_OPTIONS })
    destroyTask = () => task.destroy()
    try {
      const doc = await task.promise
      if (disposed) return true
      pdfDocument = doc
      const pagesInit = new Promise<void>((resolve) => eventBus.on('pagesinit', () => resolve(), { once: true }))
      current.setDocument(doc)
      linkService.setDocument(doc)
      await pagesInit
      if (disposed) return true
      current.currentScaleValue = 'auto'
      await current.pagesPromise
      if (disposed) return true
      pageCount.value = doc.numPages
      scalePercent.value = Math.round(current.currentScale * 100)
    } catch (error) {
      // 画面を離れて読み込みを止めたための失敗は、利用者に知らせない
      if (disposed) return true
      throw new Error(`PDF を開けませんでした: ${path}（${(error as Error).message}）`, { cause: error })
    }
    loading.value = false

    const onPageHide = () => saveNow(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveNow(true)
    }
    frame.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
    detach = () => {
      frame.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }

    const saved = store.state.progress[path]
    const found = saved === undefined ? true : goToPosition(saved.position)
    update()
    saveNow()
    return found
  }

  // PDF に入っている目次を読む。失敗したらパネルに理由を出し、例外もそのまま投げる
  async function loadOutline(): Promise<void> {
    const doc = pdfDocument
    if (doc === null || disposed) return
    try {
      const raw = await doc.getOutline()
      const entries = raw === null || raw.length === 0 ? [] : await flattenOutline(raw, resolvePageNumber)
      if (disposed) return
      outline.value = entries
      outlineState.value = { status: 'ready' }
      // 読んでいる場所の見出しを、目次を使って付け直す
      saveNow()
    } catch (error) {
      // 画面を離れて読み込みを止めたための失敗は、利用者に知らせない
      if (disposed) return
      const message = (error as Error).message
      outlineState.value = { status: 'failed', message }
      throw new Error(`PDF の目次を読み込めませんでした: ${path}（${message}）`, { cause: error })
    }
  }

  onBeforeUnmount(() => {
    saveNow()
    disposed = true
    detach?.()
    if (throttleTimer !== null) clearTimeout(throttleTimer)
    if (destroyTask !== null) destroyTask().catch(reportError)
  })

  return {
    loading,
    pageCount,
    scalePercent,
    position,
    outline,
    outlineState,
    toc,
    pageNumber,
    currentEntry,
    open,
    loadOutline,
    goToPage,
    zoom,
  }
}
