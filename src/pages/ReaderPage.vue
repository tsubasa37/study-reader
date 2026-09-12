<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BookmarksTab from '../components/reader/BookmarksTab.vue'
import DocNavHandle from '../components/reader/DocNavHandle.vue'
import HighlightsTab from '../components/reader/HighlightsTab.vue'
import ReaderBar from '../components/reader/ReaderBar.vue'
import SelectionToolbar from '../components/reader/SelectionToolbar.vue'
import SidePanel from '../components/reader/SidePanel.vue'
import TocTab from '../components/reader/TocTab.vue'
import { useReaderPage } from '../composables/useReaderPage'
import { vaultUrl } from '../lib/api'

const props = defineProps<{ path: string; bookmarkId: string | null; highlightId: string | null }>()

const reader = useReaderPage(props)
const { store, frame, highlights, entry, panelOpen, panelTab } = reader

function removeBookmark(id: string): void {
  if (window.confirm('このしおりを外しますか？')) void store.deleteBookmark(id)
}

function removeHighlight(id: string): void {
  if (window.confirm('このハイライトを消しますか？メモも一緒に消えます')) void store.deleteHighlight(id)
}
</script>

<template>
  <div class="reader">
    <ReaderBar
      :title="entry?.name ?? path"
      :section-title="frame.currentSection.value?.title ?? null"
      :panel-open="panelOpen"
      :doc-nav-hidden="reader.docNavHidden.value"
      @bookmark="reader.addBookmark"
      @search="reader.search.show"
      @toggle-doc-nav="reader.toggleDocNav"
      @toggle-panel="panelOpen = !panelOpen"
    />
    <p v-if="store.state.loaded && entry === null" class="missing">
      この資料は資料フォルダにありません: {{ path }}
      <RouterLink to="/">本棚へ戻る</RouterLink>
    </p>
    <div v-else class="stage">
      <div class="frame-wrap">
        <iframe :src="vaultUrl(path)" :title="entry?.name ?? path" @load="reader.onFrameLoad" />
        <DocNavHandle
          v-if="reader.docNavHandle.value !== null"
          :x="reader.docNavHandle.value.x"
          :width="reader.docNavHandle.value.width"
          @resize="(width) => reader.setDocNavWidth(width, false)"
          @commit="(width) => reader.setDocNavWidth(width, true)"
          @reset="reader.resetDocNavWidth"
        />
        <SelectionToolbar
          v-if="highlights.selection.value"
          :draft="highlights.selection.value"
          @pick="(color) => reader.highlightSelection(color, false)"
          @memo="reader.highlightSelection('yellow', true)"
        />
      </div>
      <SidePanel
        v-if="panelOpen"
        v-model:tab="panelTab"
        :bookmark-count="reader.bookmarks.value.length"
        :highlight-count="highlights.items.value.length"
        :read-count="frame.readInDocument.value.length"
        :leaf-count="reader.leafCount.value"
      >
        <template #toc>
          <TocTab :entries="reader.toc.value" @go="frame.goToSection" @toggle-read="frame.setRead" />
        </template>
        <template #bookmarks>
          <BookmarksTab
            :items="reader.bookmarks.value"
            :active-id="reader.activeBookmarkId.value"
            :edit-id="reader.editRequestId.value"
            @go="reader.jumpToBookmark"
            @save-memo="(id, memo) => store.updateBookmark(id, { memo })"
            @remove="removeBookmark"
          />
        </template>
        <template #highlights>
          <HighlightsTab
            :items="highlights.located.value"
            :lost="highlights.lost.value"
            :active-id="reader.activeHighlightId.value"
            :edit-id="reader.editRequestId.value"
            @go="reader.jumpToHighlight"
            @save-memo="(id, memo) => store.updateHighlight(id, { memo })"
            @recolor="(id, color) => store.updateHighlight(id, { color })"
            @remove="removeHighlight"
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

.frame-wrap {
  position: relative;
  min-height: 0;
  background: var(--sheet);
}

iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.missing {
  margin: 48px auto;
  max-width: 60ch;
  color: var(--ink-2);
}
</style>
