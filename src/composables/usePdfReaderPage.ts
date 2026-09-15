import { computed, nextTick, onMounted, ref, watch, type ShallowRef } from 'vue'
import { pdfPlaceLabel } from '../lib/pdfOutline'
import type { PanelTab } from '../types/ui'
import { notify } from './useNotices'
import { usePdfReader } from './usePdfReader'
import { useSearchDialog } from './useSearchDialog'
import { loadStudyState, useStudyStore } from './useStudyStore'

export type PdfReaderProps = {
  path: string
  bookmarkId: string | null
}

type PdfElements = {
  container: Readonly<ShallowRef<HTMLDivElement | null>>
  pages: Readonly<ShallowRef<HTMLDivElement | null>>
}

const REPLACED = '（PDF が差し替えられた可能性があります）'

export function usePdfReaderPage(props: PdfReaderProps, elements: PdfElements) {
  const store = useStudyStore()
  const search = useSearchDialog()
  const reader = usePdfReader(props.path)
  const panelOpen = ref(true)
  const panelTab = ref<PanelTab>('toc')
  const activeBookmarkId = ref<string | null>(null)
  // メモ欄を開くのは作った直後だけ。飛んできただけのときは開かない
  const editRequestId = ref<string | null>(null)

  const entry = computed(() => store.documentsByPath.value.get(props.path) ?? null)
  const bookmarks = computed(() =>
    store.state.bookmarks
      .filter((item) => item.path === props.path)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
  const place = computed(() =>
    reader.loading.value ? null : pdfPlaceLabel(reader.currentEntry.value, reader.pageNumber.value),
  )
  const meter = computed(() =>
    reader.pageCount.value === 0
      ? null
      : { ratio: reader.position.value?.scrollRatio ?? 0, label: `p.${reader.pageNumber.value} / ${reader.pageCount.value}` },
  )

  function showPanel(tab: PanelTab): void {
    panelOpen.value = true
    panelTab.value = tab
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
    if (!reader.goToPosition(bookmark.position)) {
      notify(`しおりのページがこの PDF に無いので、だいたいの位置へ移動しました${REPLACED}`)
    }
    return true
  }

  function restoreSavedPosition(): void {
    const saved = store.state.progress[props.path]
    if (saved !== undefined && !reader.goToPosition(saved.position)) {
      notify(`前回のページがこの PDF に無いので、だいたいの位置に戻しました${REPLACED}`)
    }
  }

  async function addBookmark(): Promise<void> {
    // 位置と見出しは押した瞬間のものを使う。本文の抜き出しは PDF から読むので待つ
    const position = reader.capturePosition()
    const sectionTitle = pdfPlaceLabel(reader.currentEntry.value, reader.pageNumber.value)
    const excerpt = await reader.excerptAtReadingLine()
    const created = await store.addBookmark({ path: props.path, position, sectionTitle, excerpt, memo: '' })
    activeBookmarkId.value = created.id
    editRequestId.value = created.id
    showPanel('bookmarks')
  }

  // 開いたら、しおりの指定があればそこへ、無ければ前回の続きへ移る。指定のしおりが無ければ続きへ戻す
  onMounted(async () => {
    await loadStudyState()
    if (entry.value === null) return
    await nextTick()
    const container = elements.container.value
    const pages = elements.pages.value
    if (container === null || pages === null) throw new Error('PDF を表示する場所を用意できませんでした')
    if (!(await reader.open(container, pages))) return
    const jumped = props.bookmarkId !== null && jumpToBookmark(props.bookmarkId)
    if (!jumped) restoreSavedPosition()
    reader.markOpened()
    await reader.loadOutline()
  })

  watch(
    () => props.bookmarkId,
    (id) => {
      if (id !== null && !reader.loading.value) jumpToBookmark(id)
    },
  )

  return {
    store,
    search,
    reader,
    entry,
    bookmarks,
    place,
    meter,
    panelOpen,
    panelTab,
    activeBookmarkId,
    editRequestId,
    addBookmark,
    jumpToBookmark,
  }
}
