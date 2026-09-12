<script setup lang="ts">
import { computed } from 'vue'
import type { PanelTab } from '../../types/ui'

const props = defineProps<{ bookmarkCount: number; highlightCount: number; readCount: number; leafCount: number }>()
const tab = defineModel<PanelTab>('tab', { required: true })

const tabs = computed<{ id: PanelTab; label: string; count: number | null }[]>(() => [
  { id: 'toc', label: '目次', count: null },
  { id: 'bookmarks', label: 'しおり', count: props.bookmarkCount },
  { id: 'highlights', label: 'ハイライト', count: props.highlightCount },
])
const ratio = computed(() => (props.leafCount === 0 ? 0 : props.readCount / props.leafCount))
</script>

<template>
  <aside class="panel" aria-label="目次・しおり・ハイライト">
    <div class="tabs" role="tablist">
      <button
        v-for="item in tabs"
        :key="item.id"
        role="tab"
        type="button"
        :aria-selected="tab === item.id"
        @click="tab = item.id"
      >
        {{ item.label }}<span v-if="item.count !== null" class="count num">{{ item.count }}</span>
      </button>
    </div>
    <div class="body" role="tabpanel">
      <slot v-if="tab === 'toc'" name="toc" />
      <slot v-else-if="tab === 'bookmarks'" name="bookmarks" />
      <slot v-else name="highlights" />
    </div>
    <footer v-if="leafCount > 0" class="meter">
      <div class="track"><span :style="{ width: `${ratio * 100}%` }" /></div>
      <span class="num">読了 {{ readCount }} / {{ leafCount }} 章</span>
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: 300px;
  min-height: 0;
  border-left: 1px solid var(--rule);
  background: var(--paper);
}

.tabs {
  display: flex;
  gap: 2px;
  padding: 8px 8px 0;
  border-bottom: 1px solid var(--rule);
}

.tabs button {
  margin-bottom: -1px;
  padding: 7px 9px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--ink-3);
  font-size: 13.5px;
  cursor: pointer;
}

.tabs button[aria-selected='true'] {
  border-bottom-color: var(--ribbon);
  color: var(--ink);
  font-weight: 600;
}

.count {
  margin-left: 4px;
  color: var(--ink-3);
  font-size: 11.5px;
  font-weight: 400;
}

.body {
  overflow-y: auto;
  padding: 10px 8px 16px;
}

.meter {
  display: grid;
  gap: 6px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--rule);
  color: var(--ink-2);
  font-size: 12px;
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
</style>
