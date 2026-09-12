import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { HighlightColor, TextQuote } from '../../shared/types'
import { locateQuote } from '../lib/anchoring'
import { applyDocumentNavHidden, loadDocumentNavHidden, saveDocumentNavHidden } from '../lib/documentChrome'
import { attachFrameInteractions, excerptAtTop } from '../lib/frameInteractions'
import { flashRange } from '../lib/highlightPainter'
import { indexesToRange } from '../lib/textMap'
import type { PanelTab, TocEntry } from '../types/ui'
import { notify } from './useNotices'
import { usePendingJump } from './usePendingJump'
import { useReaderFrame } from './useReaderFrame'
import { useReaderHighlights } from './useReaderHighlights'
import { useSearchDialog } from './useSearchDialog'
import { loadStudyState, useStudyStore } from './useStudyStore'

export type ReaderProps = {
  path: string
  bookmarkId: string | null
  highlightId: string | null
}

const REWRITTEN = '（教材が書き換えられた可能性があります）'

export function useReaderPage(props: ReaderProps) {
  const router = useRouter()
  const store = useStudyStore()
  const search = useSearchDialog()
  const pendingJump = usePendingJump()
  const frame = useReaderFrame(props.path)
  const highlights = useReaderHighlights(props.path, frame.session)
  const panelOpen = ref(true)
  const panelTab = ref<PanelTab>('toc')
  const docNavHidden = ref(loadDocumentNavHidden())
  const activeBookmarkId = ref<string | null>(null)
  const activeHighlightId = ref<string | null>(null)
  // メモ欄を開くのは作った直後だけ。飛んできただけのときは開かない
  const editRequestId = ref<string | null>(null)
  let detachInteractions: (() => void) | null = null

  const document = computed(() => store.documentsByPath.value.get(props.path) ?? null)
  const bookmarks = computed(() =>
    store.state.bookmarks
      .filter((item) => item.path === props.path)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
  const toc = computed<TocEntry[]>(() =>
    (frame.session.value?.sections ?? []).map((section) => ({
      id: section.id,
      title: section.title,
      depth: section.depth,
      isLeaf: section.isLeaf,
      read: frame.readSectionIds.value.includes(section.id),
      current: frame.position.value?.sectionId === section.id,
    })),
  )
  const leafCount = computed(() => frame.session.value?.leafIds.size ?? 0)

  function showPanel(tab: PanelTab): void {
    panelOpen.value = true
    panelTab.value = tab
  }

  function focusHighlight(id: string): void {
    activeHighlightId.value = id
    editRequestId.value = null
    showPanel('highlights')
  }

  function jumpToBookmark(id: string): boolean {
    const bookmark = store.state.bookmarks.find((item) => item.id === id)
    if (bookmark === undefined) {
      notify('しおりが見つかりません。外された可能性があります')
      return false
    }
    activeBookmarkId.value = id
    editRequestId.value = null
    showPanel('bookmarks')
    if (!frame.goToPosition(bookmark.position)) notify(`しおりの章が見つからないので、だいたいの位置へ移動しました${REWRITTEN}`)
    return true
  }

  function jumpToHighlight(id: string): boolean {
    focusHighlight(id)
    const range = highlights.rangeOf(id)
    if (range === null) {
      notify(`このハイライトの文章が教材の中に見つかりません${REWRITTEN}`)
      return false
    }
    frame.goToRange(range)
    highlights.flash(id)
    return true
  }

  function jumpToQuote(quote: TextQuote): boolean {
    const current = frame.session.value
    if (current === null) return false
    const map = current.textMap()
    const span = locateQuote(map.text, quote)
    if (span === null) {
      notify('検索した文章が見つかりません')
      return false
    }
    const range = indexesToRange(map, span.start, span.end, current.doc)
    frame.goToRange(range)
    flashRange(current.win, range)
    return true
  }

  function restoreSavedPosition(): void {
    const saved = store.state.progress[props.path]
    if (saved !== undefined && !frame.goToPosition(saved.position)) {
      notify(`前回の章が見つからないので、だいたいの位置に戻しました${REWRITTEN}`)
    }
  }

  function jumpToRequestedTarget(): boolean {
    if (props.bookmarkId !== null) return jumpToBookmark(props.bookmarkId)
    if (props.highlightId !== null) return jumpToHighlight(props.highlightId)
    const target = pendingJump.take(props.path)
    return target !== null && jumpToQuote(target.quote)
  }

  // 指定された場所が見つからないときは先頭で保存し直さず、前回の続きの位置へ戻す
  function jumpToInitialTarget(): void {
    if (!jumpToRequestedTarget()) restoreSavedPosition()
  }

  async function onFrameLoad(event: Event): Promise<void> {
    const iframe = event.target as HTMLIFrameElement
    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    if (win === null || doc === null) throw new Error('教材を読み込めませんでした')
    if (!doc.location.pathname.startsWith('/vault/')) return
    await loadStudyState()
    if (document.value === null) return
    const opened = await frame.open(win, doc)
    applyDocumentNavHidden(doc, docNavHidden.value)
    detachInteractions?.()
    const detachHighlights = highlights.attach(opened, focusHighlight)
    const detachFrame = attachFrameInteractions(opened, {
      openDocument: (path) => void router.push({ name: 'read', query: { path } }),
      openSearch: search.show,
      escape: () => {
        highlights.selection.value = null
      },
      popupBlocked: (url) => notify(`リンクを新しいタブで開けませんでした。ブラウザがブロックしています: ${url}`),
    })
    detachInteractions = () => {
      detachHighlights()
      detachFrame()
    }
    highlights.repaint()
    jumpToInitialTarget()
    frame.markOpened()
  }

  // 教材が自前で持つ目次を隠して本文を広げる。教材のファイルは書き換えない
  function toggleDocNav(): void {
    docNavHidden.value = !docNavHidden.value
    saveDocumentNavHidden(docNavHidden.value)
    const current = frame.session.value
    if (current !== null) applyDocumentNavHidden(current.doc, docNavHidden.value)
  }

  async function addBookmark(): Promise<void> {
    const current = frame.session.value
    if (current === null) return
    const created = await store.addBookmark({
      path: props.path,
      position: frame.capturePosition(),
      sectionTitle: frame.currentSection.value?.title ?? null,
      excerpt: excerptAtTop(current),
      memo: '',
    })
    activeBookmarkId.value = created.id
    editRequestId.value = created.id
    showPanel('bookmarks')
  }

  async function highlightSelection(color: HighlightColor, withMemo: boolean): Promise<void> {
    const created = await highlights.createFromSelection(color)
    if (created === null || !withMemo) return
    focusHighlight(created.id)
    editRequestId.value = created.id
  }

  watch(pendingJump.pending, (target) => {
    if (target?.path !== props.path || frame.session.value === null) return
    pendingJump.take(props.path)
    jumpToQuote(target.quote)
  })
  watch(
    () => props.bookmarkId,
    (id) => {
      if (id !== null && frame.session.value !== null) jumpToBookmark(id)
    },
  )
  watch(
    () => props.highlightId,
    (id) => {
      if (id !== null && frame.session.value !== null) jumpToHighlight(id)
    },
  )

  onBeforeUnmount(() => detachInteractions?.())

  return {
    store,
    search,
    frame,
    highlights,
    document,
    bookmarks,
    toc,
    leafCount,
    panelOpen,
    panelTab,
    docNavHidden,
    toggleDocNav,
    activeBookmarkId,
    activeHighlightId,
    editRequestId,
    onFrameLoad,
    addBookmark,
    highlightSelection,
    jumpToBookmark,
    jumpToHighlight,
  }
}
