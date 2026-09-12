import { computed, ref, shallowRef, watch, type ShallowRef } from 'vue'
import type { Highlight, HighlightColor } from '../../shared/types'
import { locateQuote, quoteFromRange } from '../lib/anchoring'
import { flashRange, installHighlightStyles, paintHighlights } from '../lib/highlightPainter'
import { sectionContaining } from '../lib/sections'
import { indexesToRange } from '../lib/textMap'
import type { HighlightAnchor, ReaderSession, SelectionDraft } from '../types/ui'
import { notify } from './useNotices'
import { useStudyStore } from './useStudyStore'

const MAX_QUOTE_LENGTH = 2000

export function useReaderHighlights(path: string, session: ShallowRef<ReaderSession | null>) {
  const store = useStudyStore()
  const items = computed(() => store.state.highlights.filter((item) => item.path === path))
  const anchors = shallowRef<ReadonlyMap<string, HighlightAnchor>>(new Map())
  const selection = ref<SelectionDraft | null>(null)

  const located = computed(() =>
    items.value
      .filter((item) => anchors.value.has(item.id))
      .sort((a, b) => (anchors.value.get(a.id)?.start ?? 0) - (anchors.value.get(b.id)?.start ?? 0)),
  )
  const lost = computed(() =>
    session.value === null ? [] : items.value.filter((item) => !anchors.value.has(item.id)),
  )

  function repaint(): void {
    const current = session.value
    if (current === null) return
    const map = current.textMap()
    const next = new Map<string, HighlightAnchor>()
    for (const item of items.value) {
      const span = locateQuote(map.text, item.quote)
      if (span !== null) next.set(item.id, { start: span.start, range: indexesToRange(map, span.start, span.end, current.doc) })
    }
    anchors.value = next
    paintHighlights(
      current.win,
      items.value.flatMap((item) => {
        const anchor = next.get(item.id)
        return anchor === undefined ? [] : [{ color: item.color, range: anchor.range }]
      }),
    )
  }

  watch([session, items], repaint)

  function readSelection(): void {
    const current = session.value
    const selected = current?.win.getSelection()
    if (current == null || selected == null || selected.isCollapsed || selected.rangeCount === 0) {
      selection.value = null
      return
    }
    const range = selected.getRangeAt(0)
    const quote = quoteFromRange(current.textMap(), range)
    if (quote === null) {
      selection.value = null
      return
    }
    const rect = range.getBoundingClientRect()
    const section = sectionContaining(current.sections, range.startContainer)
    selection.value = {
      quote,
      sectionId: section?.id ?? null,
      sectionTitle: section?.title ?? null,
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    }
  }

  async function createFromSelection(color: HighlightColor): Promise<Highlight | null> {
    const draft = selection.value
    const current = session.value
    if (draft === null || current === null) return null
    if (draft.quote.exact.length > MAX_QUOTE_LENGTH) {
      notify(`ハイライトは ${MAX_QUOTE_LENGTH} 文字までです。短く選び直してください`)
      return null
    }
    const created = await store.addHighlight({
      path,
      sectionId: draft.sectionId,
      sectionTitle: draft.sectionTitle,
      quote: draft.quote,
      color,
      memo: '',
    })
    current.win.getSelection()?.removeAllRanges()
    selection.value = null
    return created
  }

  function highlightAt(x: number, y: number): string | null {
    for (const [id, anchor] of anchors.value) {
      for (const rect of anchor.range.getClientRects()) {
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id
      }
    }
    return null
  }

  function attach(current: ReaderSession, onHighlightClick: (id: string) => void): () => void {
    installHighlightStyles(current.doc)
    const onMouseUp = () => setTimeout(readSelection, 0)
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.shiftKey) readSelection()
    }
    const clearSelection = () => {
      selection.value = null
    }
    const onClick = (event: MouseEvent) => {
      if (current.win.getSelection()?.isCollapsed === false) return
      const id = highlightAt(event.clientX, event.clientY)
      if (id !== null) onHighlightClick(id)
    }
    current.doc.addEventListener('mouseup', onMouseUp)
    current.doc.addEventListener('keyup', onKeyUp)
    current.doc.addEventListener('mousedown', clearSelection)
    current.doc.addEventListener('click', onClick)
    current.win.addEventListener('scroll', clearSelection, { passive: true })
    return () => {
      current.doc.removeEventListener('mouseup', onMouseUp)
      current.doc.removeEventListener('keyup', onKeyUp)
      current.doc.removeEventListener('mousedown', clearSelection)
      current.doc.removeEventListener('click', onClick)
      current.win.removeEventListener('scroll', clearSelection)
    }
  }

  function rangeOf(id: string): Range | null {
    return anchors.value.get(id)?.range ?? null
  }

  function flash(id: string): void {
    const current = session.value
    const range = rangeOf(id)
    if (current !== null && range !== null) flashRange(current.win, range)
  }

  return { items, located, lost, selection, repaint, attach, createFromSelection, rangeOf, flash }
}
