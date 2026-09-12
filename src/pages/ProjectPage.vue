<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import SearchButton from '../components/common/SearchButton.vue'
import DocumentRow from '../components/library/DocumentRow.vue'
import { useDocumentRows } from '../composables/useDocumentRows'
import { useSearchDialog } from '../composables/useSearchDialog'
import { useStudyStore } from '../composables/useStudyStore'
import { formatWhen } from '../lib/format'
import { groupIntoProjects } from '../lib/projects'

const props = defineProps<{ folder: string }>()

const store = useStudyStore()
const search = useSearchDialog()

const project = computed(
  () =>
    groupIntoProjects(
      store.state.documents,
      store.state.progress,
      store.state.bookmarks,
      store.state.highlights,
    ).projects.find((candidate) => candidate.folder === props.folder) ?? null,
)

const rows = useDocumentRows(computed(() => project.value?.documents ?? []))
</script>

<template>
  <div class="project">
    <header class="head">
      <RouterLink class="btn btn-ghost" to="/"><ArrowLeft :size="16" />本棚</RouterLink>
      <h1>{{ folder }}</h1>
      <SearchButton @click="search.show" />
    </header>
    <main class="body">
      <p v-if="!store.state.loaded" class="empty">読み込んでいます…</p>
      <p v-else-if="project === null" class="empty">
        このフォルダは資料フォルダにありません: {{ folder }}
      </p>
      <template v-else>
        <div class="summary">
          <span class="num">{{ project.documents.length }} 冊</span>
          <span v-if="project.totalSections > 0" class="num">
            読了 {{ project.readSections }} / {{ project.totalSections }} 章
          </span>
          <span v-if="project.lastOpenedAt" class="num">最後に読んだ {{ formatWhen(project.lastOpenedAt) }}</span>
          <RouterLink
            v-if="project.lastDocument"
            class="btn btn-primary"
            :to="{ name: 'read', query: { path: project.lastDocument.path } }"
          >
            続きから読む
          </RouterLink>
        </div>
        <ul class="rows">
          <DocumentRow v-for="row in rows" :key="row.document.path" v-bind="row" :show-folder="false" />
        </ul>
      </template>
    </main>
  </div>
</template>

<style scoped>
.project {
  overflow-y: auto;
  height: 100%;
}

.head,
.body {
  width: min(980px, 100% - 48px);
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

.body {
  display: grid;
  gap: 16px;
  padding-bottom: 64px;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  align-items: center;
  color: var(--ink-2);
  font-size: 12.5px;
}

.summary .btn {
  margin-left: auto;
  text-decoration: none;
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--rule);
}
</style>
