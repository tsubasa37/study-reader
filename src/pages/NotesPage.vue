<script setup lang="ts">
import { ArrowLeft, CircleAlert } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SearchButton from '../components/common/SearchButton.vue'
import NoteCard from '../components/notes/NoteCard.vue'
import { useNoteGroups, type NoteFilter } from '../composables/useNoteGroups'
import { useSearchDialog } from '../composables/useSearchDialog'
import { useSearchIndex } from '../composables/useSearchIndex'
import { loadStudyState, useStudyStore } from '../composables/useStudyStore'

const store = useStudyStore()
const search = useSearchDialog()
const { indexed, ensureIndex } = useSearchIndex()
const filter = ref<NoteFilter>({ kind: 'all', path: '', text: '' })
const { groups, total } = useNoteGroups(filter, indexed)

onMounted(async () => {
  await loadStudyState()
  await ensureIndex(store.state.documents)
})
</script>

<template>
  <div class="notes">
    <header class="head">
      <RouterLink class="btn btn-ghost" to="/"><ArrowLeft :size="16" />本棚</RouterLink>
      <h1>しおりとハイライト</h1>
      <SearchButton @click="search.show" />
    </header>
    <div class="filters" role="search">
      <select v-model="filter.kind" class="field" aria-label="種類">
        <option value="all">すべて</option>
        <option value="highlight">ハイライト</option>
        <option value="bookmark">しおり</option>
      </select>
      <select v-model="filter.path" class="field" aria-label="資料">
        <option value="">すべての資料</option>
        <option v-for="document in store.state.documents" :key="document.path" :value="document.path">{{ document.name }}</option>
      </select>
      <input v-model="filter.text" class="field" type="search" placeholder="メモや文章で絞り込む" aria-label="メモや文章で絞り込む" />
      <span class="num count">{{ total }} 件</span>
    </div>
    <main class="groups">
      <p v-if="!store.state.loaded" class="empty">読み込んでいます…</p>
      <p v-else-if="groups.length === 0" class="empty">該当するしおり・ハイライトはありません。</p>
      <section v-for="group in groups" :key="group.path" class="group" :aria-label="group.name">
        <h2>
          {{ group.name }}
          <span v-if="group.missing" class="missing"><CircleAlert :size="13" />ファイルが見つかりません（本棚で引き継げます）</span>
        </h2>
        <ul class="note-list">
          <NoteCard v-for="entry in group.entries" :key="entry.id" :entry="entry" :openable="!group.missing" />
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.notes {
  overflow-y: auto;
  height: 100%;
}

.head,
.filters,
.groups {
  width: min(860px, 100% - 48px);
  margin: 0 auto;
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

.filters {
  display: grid;
  grid-template-columns: 140px 220px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding-bottom: 22px;
}

.count {
  color: var(--ink-3);
  font-size: 12.5px;
}

.groups {
  display: grid;
  gap: 28px;
  padding-bottom: 64px;
}

.group {
  display: grid;
  gap: 10px;
}

h2 {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: baseline;
  margin: 0;
  font: 600 17px/1.4 var(--f-display);
}

.missing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--warn-ink);
  font: 500 12px var(--f-ui);
}

@media (max-width: 720px) {
  .filters {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
