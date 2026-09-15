<script setup lang="ts">
import { NotebookPen } from '@lucide/vue'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import SearchButton from '../components/common/SearchButton.vue'
import DocumentRow from '../components/library/DocumentRow.vue'
import ProjectCard from '../components/library/ProjectCard.vue'
import ResumeCard from '../components/library/ResumeCard.vue'
import { useDocumentRows } from '../composables/useDocumentRows'
import { reportError } from '../composables/useNotices'
import { useSearchDialog } from '../composables/useSearchDialog'
import { useStudyStore } from '../composables/useStudyStore'
import { groupIntoProjects } from '../lib/projects'

const store = useStudyStore()
const search = useSearchDialog()

onMounted(() => {
  if (store.state.loaded) store.refreshDocuments().catch(reportError)
})

// プロジェクト = 資料フォルダ直下のフォルダ。フォルダが1つも無ければ今までどおりの一覧になる
const shelf = computed(() =>
  groupIntoProjects(store.state.documents, store.state.progress, store.state.bookmarks, store.state.highlights),
)
const looseRows = useDocumentRows(computed(() => shelf.value.loose))

const resume = computed(() => {
  const progress = store.latestProgress.value
  const document = progress === null ? undefined : store.documentsByPath.value.get(progress.path)
  return progress === null || document === undefined ? null : { progress, document }
})
</script>

<template>
  <div class="library">
    <header class="head">
      <div class="brand">
        <span class="ribbon" aria-hidden="true" />
        <div>
          <p class="app">つづき</p>
          <h1>{{ store.state.vaultName || '資料フォルダ' }}</h1>
        </div>
      </div>
      <nav class="actions" aria-label="本棚の操作">
        <SearchButton @click="search.show" />
        <RouterLink class="btn" to="/notes"><NotebookPen :size="15" />しおりとハイライト</RouterLink>
      </nav>
    </header>

    <main class="shelf">
      <p v-if="!store.state.loaded" class="empty">資料フォルダを読み込んでいます…</p>
      <template v-else>
        <ResumeCard v-if="resume" :document="resume.document" :progress="resume.progress" />
        <section v-if="shelf.projects.length > 0" aria-labelledby="projects-title" class="projects">
          <h2 id="projects-title" class="section-title">
            プロジェクト <span class="num">{{ shelf.projects.length }}</span>
          </h2>
          <ul class="cards">
            <ProjectCard v-for="project in shelf.projects" :key="project.folder" :project="project" />
          </ul>
        </section>
        <section
          v-if="looseRows.length > 0 || shelf.projects.length === 0"
          aria-labelledby="documents-title"
          class="documents"
        >
          <h2 id="documents-title" class="section-title">
            {{ shelf.projects.length > 0 ? 'フォルダに入れていない資料' : '資料' }}
            <span class="num">{{ looseRows.length }}</span>
          </h2>
          <p v-if="looseRows.length === 0" class="empty">資料フォルダに HTML・PDF の教材がありません。</p>
          <ul v-else class="rows">
            <DocumentRow v-for="row in looseRows" :key="row.document.path" v-bind="row" />
          </ul>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.library {
  overflow-y: auto;
  height: 100%;
}

.head,
.shelf {
  width: min(980px, 100% - 48px);
  margin: 0 auto;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 36px 0 28px;
}

.brand {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.brand .ribbon {
  width: 14px;
  height: 36px;
}

.app {
  margin: 0;
  color: var(--ribbon);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

h1 {
  margin: 0;
  font: 600 28px/1.3 var(--f-display);
}

.actions {
  display: flex;
  gap: 8px;
}

.actions .btn {
  text-decoration: none;
}

.shelf {
  display: grid;
  gap: 36px;
  padding-bottom: 64px;
}

.documents {
  display: grid;
  gap: 10px;
}

.section-title {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.projects {
  display: grid;
  gap: 10px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--rule);
}
</style>
