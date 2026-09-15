<script setup lang="ts">
import 'pdfjs-dist/web/pdf_viewer.css'
import { Minus, Plus } from '@lucide/vue'
import { useTemplateRef } from 'vue'
import { RouterLink } from 'vue-router'
import BookmarksTab from '../components/reader/BookmarksTab.vue'
import PdfTocTab from '../components/reader/PdfTocTab.vue'
import ReaderBar from '../components/reader/ReaderBar.vue'
import SidePanel from '../components/reader/SidePanel.vue'
import { usePdfReaderPage } from '../composables/usePdfReaderPage'

const props = defineProps<{ path: string; bookmarkId: string | null }>()

const container = useTemplateRef<HTMLDivElement>('container')
const pages = useTemplateRef<HTMLDivElement>('pages')
const page = usePdfReaderPage(props, { container, pages })
const { store, reader, panelOpen, panelTab } = page

function removeBookmark(id: string): void {
  if (window.confirm('このしおりを外しますか？')) void store.deleteBookmark(id)
}
</script>

<template>
  <div class="reader">
    <ReaderBar
      :title="page.entry.value?.name ?? path"
      :section-title="page.place.value"
      :panel-open="panelOpen"
      :doc-nav-hidden="null"
      is-pdf
      :bookmark-disabled="reader.loading.value"
      @bookmark="page.addBookmark"
      @search="page.search.show"
      @toggle-panel="panelOpen = !panelOpen"
    >
      <template #tools>
        <div class="zoom" role="group" aria-label="表示の大きさ">
          <button
            class="icon-button"
            type="button"
            aria-label="縮小する"
            title="縮小する"
            :disabled="reader.loading.value"
            @click="reader.zoom('out')"
          >
            <Minus :size="15" />
          </button>
          <button
            class="btn btn-ghost num"
            type="button"
            title="画面に合わせる"
            :disabled="reader.loading.value"
            @click="reader.zoom('fit')"
          >
            {{ reader.scalePercent.value }}%
          </button>
          <button
            class="icon-button"
            type="button"
            aria-label="拡大する"
            title="拡大する"
            :disabled="reader.loading.value"
            @click="reader.zoom('in')"
          >
            <Plus :size="15" />
          </button>
        </div>
      </template>
    </ReaderBar>
    <p v-if="store.state.loaded && page.entry.value === null" class="missing">
      この資料は資料フォルダにありません: {{ path }}
      <RouterLink to="/">本棚へ戻る</RouterLink>
    </p>
    <div v-else class="stage">
      <div class="pdf-wrap">
        <div ref="container" class="pdf-scroller">
          <div ref="pages" class="pdfViewer" />
        </div>
        <p v-if="reader.loading.value" class="load-note">PDF を読み込んでいます…</p>
      </div>
      <SidePanel
        v-if="panelOpen"
        v-model:tab="panelTab"
        :tabs="['toc', 'bookmarks']"
        :bookmark-count="page.bookmarks.value.length"
        :highlight-count="0"
        :read-count="0"
        :leaf-count="0"
        :meter="page.meter.value"
      >
        <template #toc>
          <PdfTocTab
            :entries="reader.toc.value"
            :state="reader.outlineState.value"
            :has-outline="reader.outline.value.length > 0"
            :current-id="reader.currentEntry.value?.id ?? null"
            @go="reader.goToPage"
          />
        </template>
        <template #bookmarks>
          <BookmarksTab
            :items="page.bookmarks.value"
            :active-id="page.activeBookmarkId.value"
            :edit-id="page.editRequestId.value"
            @go="page.jumpToBookmark"
            @save-memo="(id, memo) => store.updateBookmark(id, { memo })"
            @remove="removeBookmark"
          />
        </template>
      </SidePanel>
    </div>
  </div>
</template>

<style scoped>
.reader {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  overflow: hidden;
}

.stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 0;
}

.pdf-wrap {
  position: relative;
  min-height: 0;
  background: var(--desk);
}

.pdf-scroller {
  position: absolute;
  inset: 0;
  overflow: auto;
}

.pdf-scroller :deep(.pdfViewer) {
  padding: 16px 0 40px;
}

.pdf-scroller :deep(.pdfViewer .page) {
  margin: 0 auto 16px;
  box-shadow: var(--shadow);
}

.load-note {
  position: absolute;
  top: 16px;
  right: 0;
  left: 0;
  margin: 0;
  color: var(--ink-3);
  font-size: 13px;
  text-align: center;
}

.zoom {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}

.zoom .btn {
  min-width: 58px;
  justify-content: center;
}

.missing {
  margin: 48px auto;
  max-width: 60ch;
  color: var(--ink-2);
}
</style>
