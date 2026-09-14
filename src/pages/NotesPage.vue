<script setup lang="ts">
import { ArrowLeft, Bookmark, Highlighter } from '@lucide/vue'
import { nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import SearchButton from '../components/common/SearchButton.vue'
import BookmarkRow from '../components/notes/BookmarkRow.vue'
import ColorFilter from '../components/notes/ColorFilter.vue'
import HighlightTree from '../components/notes/HighlightTree.vue'
import NoteCard from '../components/notes/NoteCard.vue'
import { useNoteGroups } from '../composables/useNoteGroups'
import { useSearchDialog } from '../composables/useSearchDialog'
import { useSearchIndex } from '../composables/useSearchIndex'
import { loadStudyState, useStudyStore } from '../composables/useStudyStore'
import type { HighlightFilter, NoteEntry } from '../types/ui'

type NoteKind = NoteEntry['kind']

// 前回開いていたタブ。初めてならハイライトから開く
const TAB_KEY = 'study-reader:notes-tab'

const store = useStudyStore()
const search = useSearchDialog()
const { indexed, ensureIndex } = useSearchIndex()
const filter = ref<HighlightFilter>({ place: { kind: 'all' }, color: null, text: '' })
const { groups, total, tree, colorCounts, bookmarks, counts } = useNoteGroups(filter, indexed)

const tab = ref<NoteKind>(window.localStorage.getItem(TAB_KEY) === 'bookmark' ? 'bookmark' : 'highlight')
watch(tab, (value) => window.localStorage.setItem(TAB_KEY, value))

const tabList = useTemplateRef<HTMLElement>('tabList')

// 左右の矢印キーでもタブを移る
async function switchTab(): Promise<void> {
  tab.value = tab.value === 'highlight' ? 'bookmark' : 'highlight'
  await nextTick()
  tabList.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
}

onMounted(async () => {
  await loadStudyState()
  await ensureIndex(store.state.documents)
})
</script>

<template>
  <div class="notes" :class="{ wide: tree !== null }">
    <header class="head">
      <RouterLink class="btn btn-ghost" to="/"><ArrowLeft :size="16" />本棚</RouterLink>
      <h1>しおりとハイライト</h1>
      <SearchButton @click="search.show" />
    </header>
    <div
      ref="tabList"
      class="tabs"
      role="tablist"
      aria-label="種類"
      @keydown.left.prevent="switchTab"
      @keydown.right.prevent="switchTab"
    >
      <button
        id="notes-tab-highlight"
        class="tab"
        type="button"
        role="tab"
        aria-controls="notes-pane"
        :aria-selected="tab === 'highlight'"
        :tabindex="tab === 'highlight' ? 0 : -1"
        @click="tab = 'highlight'"
      >
        <Highlighter :size="15" />ハイライト<span class="num">{{ counts.highlight }}</span>
      </button>
      <button
        id="notes-tab-bookmark"
        class="tab"
        type="button"
        role="tab"
        aria-controls="notes-pane"
        :aria-selected="tab === 'bookmark'"
        :tabindex="tab === 'bookmark' ? 0 : -1"
        @click="tab = 'bookmark'"
      >
        <Bookmark :size="15" />しおり<span class="num">{{ counts.bookmark }}</span>
      </button>
    </div>
    <main id="notes-pane" class="pane" role="tabpanel" :aria-labelledby="`notes-tab-${tab}`">
      <p v-if="!store.state.loaded" class="empty">読み込んでいます…</p>
      <div v-else-if="tab === 'highlight'" class="highlights" :class="{ 'with-tree': tree !== null }">
        <HighlightTree v-if="tree" v-model="filter.place" :tree="tree" />
        <div class="highlight-main">
          <p v-if="counts.highlight === 0" class="empty">
            まだハイライトはありません。教材の文章をなぞって選ぶと、色を付けてメモを書けます。
          </p>
          <template v-else>
            <ColorFilter v-model="filter.color" :counts="colorCounts" />
            <div class="search-row" role="search">
              <input
                v-model="filter.text"
                class="field"
                type="search"
                placeholder="メモや文章で絞り込む"
                aria-label="メモや文章で絞り込む"
              />
              <span class="num count">{{ total }} 件</span>
            </div>
            <p v-if="groups.length === 0" class="empty">該当するハイライトはありません。</p>
            <section v-for="group in groups" :key="group.path" class="group" :aria-label="group.name">
              <h2>
                {{ group.name }}
                <small v-if="group.project">{{ group.project }}</small>
              </h2>
              <ul class="note-list">
                <NoteCard v-for="entry in group.entries" :key="entry.id" :entry="entry" />
              </ul>
            </section>
          </template>
        </div>
      </div>
      <template v-else>
        <p v-if="bookmarks.length === 0" class="empty">
          まだしおりはありません。読書画面の「しおりを挟む」で、今読んでいる位置を残せます。
        </p>
        <ul v-else class="bookmark-list">
          <BookmarkRow v-for="entry in bookmarks" :key="entry.id" :entry="entry" />
        </ul>
      </template>
    </main>
  </div>
</template>

<style scoped>
.notes {
  overflow-y: auto;
  height: 100%;
}

.head,
.tabs,
.pane {
  width: min(860px, 100% - 48px);
  margin: 0 auto;
}

.wide .head,
.wide .tabs,
.wide .pane {
  width: min(1060px, 100% - 48px);
}

.head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 28px 0 18px;
}

.head .btn {
  text-decoration: none;
}

h1 {
  flex: 1;
  margin: 0;
  font: 600 24px/1.3 var(--f-display);
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--rule);
}

.tab {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  margin-bottom: -1px;
  padding: 8px 14px 9px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.tab:hover {
  color: var(--ink);
}

.tab[aria-selected='true'] {
  border-bottom-color: var(--ribbon);
  color: var(--ink);
}

.tab .num {
  color: var(--ink-3);
  font-size: 12px;
  font-weight: 400;
}

.pane {
  padding-bottom: 64px;
}

.highlights.with-tree {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}

.highlight-main {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.count {
  color: var(--ink-3);
  font-size: 12.5px;
}

.group {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

h2 {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  margin: 0;
  font: 600 17px/1.4 var(--f-display);
}

h2 small {
  color: var(--ink-3);
  font: 12px var(--f-ui);
}

.bookmark-list {
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--sheet);
  list-style: none;
}

.missing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--warn-ink);
  font: 500 12px var(--f-ui);
}

@media (max-width: 720px) {
  .highlights.with-tree {
    grid-template-columns: 1fr;
  }
}
</style>
