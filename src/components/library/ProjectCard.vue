<script setup lang="ts">
import { Bookmark, Highlighter } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatWhen } from '../../lib/format'
import type { ProjectSummary } from '../../lib/projects'

const props = defineProps<{ project: ProjectSummary }>()

const ratio = computed(() =>
  props.project.totalSections === 0 ? 0 : props.project.readSections / props.project.totalSections,
)

const label = computed(() => {
  const { openedDocuments, readSections, totalSections } = props.project
  if (openedDocuments === 0) return '未読'
  if (totalSections === 0) return '読みかけ'
  return readSections === totalSections ? '読了' : `${readSections} / ${totalSections} 章`
})
</script>

<template>
  <li>
    <RouterLink class="card" :to="{ name: 'project', query: { folder: project.folder } }">
      <strong class="name">{{ project.folder }}</strong>
      <span class="track"><span :style="{ width: `${ratio * 100}%` }" /></span>
      <span class="meta num">
        {{ project.documents.length }} 冊 ・ {{ label }}
        <template v-if="project.lastOpenedAt"> ・ {{ formatWhen(project.lastOpenedAt) }}</template>
      </span>
      <span v-if="project.lastDocument" class="last">
        続き: {{ project.lastDocument.name
        }}<template v-if="project.lastDocument.sectionTitle"> / {{ project.lastDocument.sectionTitle }}</template>
      </span>
      <span v-else class="last muted">まだ開いていません</span>
      <span class="counts num">
        <Bookmark :size="12" />{{ project.bookmarks }}
        <Highlighter :size="12" />{{ project.highlights }}
      </span>
    </RouterLink>
  </li>
</template>

<style scoped>
.card {
  display: grid;
  gap: 6px;
  height: 100%;
  padding: 16px 18px 14px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--sheet);
  color: var(--ink);
  text-decoration: none;
}

.card:hover {
  border-color: var(--ribbon);
}

.name {
  font: 600 17px/1.4 var(--f-display);
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

.meta {
  color: var(--ink-2);
  font-size: 12px;
}

.last {
  overflow: hidden;
  color: var(--ink-3);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last.muted {
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
</style>
