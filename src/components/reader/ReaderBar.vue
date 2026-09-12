<script setup lang="ts">
import { ArrowLeft, Bookmark, PanelLeft, PanelRight } from '@lucide/vue'
import { RouterLink } from 'vue-router'
import SearchButton from '../common/SearchButton.vue'

defineProps<{ title: string; sectionTitle: string | null; panelOpen: boolean; docNavHidden: boolean }>()
const emit = defineEmits<{ bookmark: []; search: []; toggleDocNav: []; togglePanel: [] }>()
</script>

<template>
  <header class="bar">
    <RouterLink class="btn btn-ghost" to="/"><ArrowLeft :size="16" />本棚</RouterLink>
    <div class="crumb">
      <strong>{{ title }}</strong>
      <span v-if="sectionTitle">{{ sectionTitle }}</span>
    </div>
    <SearchButton @click="emit('search')" />
    <button class="btn btn-primary" type="button" @click="emit('bookmark')"><Bookmark :size="15" />しおりを挟む</button>
    <button
      class="icon-button"
      type="button"
      :aria-pressed="docNavHidden"
      :aria-label="docNavHidden ? '教材の目次を表示する' : '教材の目次を隠して本文を広げる'"
      :title="docNavHidden ? '教材の目次を表示する' : '教材の目次を隠して本文を広げる'"
      @click="emit('toggleDocNav')"
    >
      <PanelLeft :size="16" />
    </button>
    <button
      class="icon-button"
      type="button"
      :aria-pressed="panelOpen"
      :aria-label="panelOpen ? 'パネルを閉じる' : 'パネルを開く'"
      @click="emit('togglePanel')"
    >
      <PanelRight :size="16" />
    </button>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);
}

.btn-ghost {
  text-decoration: none;
}

.crumb {
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.crumb strong {
  font: 600 15px/1.3 var(--f-display);
  white-space: nowrap;
}

.crumb span {
  overflow: hidden;
  color: var(--ink-3);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
