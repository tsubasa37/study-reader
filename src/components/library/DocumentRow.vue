<script setup lang="ts">
import { Bookmark, Highlighter } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { DocumentEntry, DocumentProgress } from '../../../shared/types'
import { notify } from '../../composables/useNotices'
import { useStudyStore } from '../../composables/useStudyStore'
import { formatWhen } from '../../lib/format'
import { summarizeProgress } from '../../lib/progressSummary'
import { projectFolderOf } from '../../lib/projects'
import MoveMenu from './MoveMenu.vue'

const props = withDefaults(
  defineProps<{
    document: DocumentEntry
    progress: DocumentProgress | null
    bookmarks: number
    highlights: number
    showFolder?: boolean
  }>(),
  { showFolder: true },
)

const store = useStudyStore()
const summary = computed(() => summarizeProgress(props.progress ?? undefined))

async function move(folder: string): Promise<void> {
  const result = await store.moveDocument(props.document.path, folder)
  const where = folder === '' ? '資料フォルダの直下' : folder
  const extra = result.movedFiles.length > 1 ? `（${result.movedFiles.length} ファイル）` : ''
  notify(`${props.document.name} を ${where} へ移しました${extra}`)
}
</script>

<template>
  <li class="item">
    <RouterLink class="row" :to="{ name: 'read', query: { path: document.path } }">
      <span class="name">
        <span class="title-line">
          <strong>{{ document.name }}</strong>
          <span v-if="document.kind === 'pdf'" class="kind-tag">PDF</span>
        </span>
        <small v-if="showFolder && document.folder">{{ document.folder }}</small>
      </span>
      <span class="progress">
        <span class="track"><span :style="{ width: `${summary.ratio * 100}%` }" /></span>
        <span class="num label" :class="{ muted: !summary.started }">{{ summary.label }}</span>
      </span>
      <span class="counts num" :aria-label="`しおり ${bookmarks} 件、ハイライト ${highlights} 件`">
        <Bookmark :size="13" />{{ bookmarks }}
        <Highlighter :size="13" />{{ highlights }}
      </span>
      <span class="when num">{{ progress ? formatWhen(progress.lastOpenedAt) : '—' }}</span>
    </RouterLink>
    <MoveMenu
      :name="document.name"
      :folders="store.projectFolders.value"
      :current="projectFolderOf(document.path)"
      @move="move"
    />
  </li>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border-top: 1px solid var(--rule);
}

.item:hover {
  background: var(--paper);
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px 96px 76px;
  gap: 16px;
  align-items: center;
  padding: 14px 6px;
  color: var(--ink);
  text-decoration: none;
}

.name {
  display: grid;
  min-width: 0;
}

.title-line {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.name strong {
  overflow: hidden;
  min-width: 0;
  font: 600 16px/1.45 var(--f-display);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name small {
  color: var(--ink-3);
  font-size: 12px;
}

.progress {
  display: grid;
  gap: 4px;
}

.track {
  overflow: hidden;
  height: 4px;
  border-radius: 2px;
  background: var(--rule);
}

.track span {
  display: block;
  height: 100%;
  background: var(--ribbon);
}

.label {
  color: var(--ink-2);
  font-size: 12px;
}

.label.muted {
  color: var(--ink-3);
}

.counts {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--ink-3);
  font-size: 12px;
}

.counts svg:last-of-type {
  margin-left: 8px;
}

.when {
  color: var(--ink-3);
  font-size: 12px;
  text-align: right;
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: minmax(0, 1fr) 120px;
  }

  .counts,
  .when {
    display: none;
  }
}
</style>
