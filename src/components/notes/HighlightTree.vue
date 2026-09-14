<script setup lang="ts">
import type { HighlightTree, NotePlace } from '../../types/ui'

defineProps<{ tree: HighlightTree }>()
const place = defineModel<NotePlace>({ required: true })

const isProject = (folder: string) => place.value.kind === 'project' && place.value.folder === folder
const isDocument = (path: string) => place.value.kind === 'document' && place.value.path === path
</script>

<template>
  <nav class="tree" aria-label="資料で絞り込む">
    <p class="label">資料</p>
    <button class="node" type="button" :aria-pressed="place.kind === 'all'" @click="place = { kind: 'all' }">
      <span class="name">すべての資料</span><span class="num">{{ tree.count }}</span>
    </button>
    <template v-for="project in tree.projects" :key="project.folder">
      <button
        class="node project"
        type="button"
        :title="project.folder"
        :aria-pressed="isProject(project.folder)"
        @click="place = { kind: 'project', folder: project.folder }"
      >
        <span class="name">{{ project.folder }}</span><span class="num">{{ project.count }}</span>
      </button>
      <button
        v-for="document in project.documents"
        :key="document.path"
        class="node child"
        type="button"
        :title="document.name"
        :aria-pressed="isDocument(document.path)"
        @click="place = { kind: 'document', path: document.path }"
      >
        <span class="name">{{ document.name }}</span><span class="num">{{ document.count }}</span>
      </button>
    </template>
    <template v-if="tree.loose.length > 0">
      <p class="label">フォルダに入れていない資料</p>
      <button
        v-for="document in tree.loose"
        :key="document.path"
        class="node"
        type="button"
        :title="document.name"
        :aria-pressed="isDocument(document.path)"
        @click="place = { kind: 'document', path: document.path }"
      >
        <span class="name">{{ document.name }}</span><span class="num">{{ document.count }}</span>
      </button>
    </template>
  </nav>
</template>

<style scoped>
.tree {
  position: sticky;
  top: 16px;
  display: grid;
  align-content: start;
  gap: 1px;
}

.label {
  margin: 14px 0 4px;
  padding: 0 8px;
  color: var(--ink-3);
  font-size: 11px;
  letter-spacing: 0.08em;
}

.label:first-child {
  margin-top: 0;
}

.node {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  cursor: pointer;
}

.node:hover {
  background: var(--sheet);
  color: var(--ink);
}

.node[aria-pressed='true'] {
  background: var(--ribbon-soft);
  color: var(--ink);
  font-weight: 600;
}

.project {
  color: var(--ink);
}

.child {
  padding-left: 22px;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num {
  flex: none;
  color: var(--ink-3);
  font-size: 11.5px;
  font-weight: 400;
}

@media (max-width: 720px) {
  .tree {
    position: static;
  }
}
</style>
