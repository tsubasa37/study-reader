<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue'
import type { OutlineState, PdfTocEntry } from '../../lib/pdfOutline'

const props = defineProps<{ entries: PdfTocEntry[]; state: OutlineState; hasOutline: boolean; currentId: string | null }>()
const emit = defineEmits<{ go: [pageNumber: number] }>()
const list = useTemplateRef<HTMLOListElement>('list')

watch(
  () => props.currentId,
  async () => {
    await nextTick()
    list.value?.querySelector('.current')?.scrollIntoView({ block: 'nearest' })
  },
)

function go(entry: PdfTocEntry): void {
  if (entry.pageNumber !== null) emit('go', entry.pageNumber)
}
</script>

<template>
  <p v-if="state.status === 'loading'" class="empty">目次を読み込んでいます…</p>
  <p v-else-if="state.status === 'failed'" class="empty failed">
    目次を読み込めませんでした（{{ state.message }}）。ページはそのまま読めます。
  </p>
  <template v-else>
    <p v-if="!hasOutline" class="empty note">この PDF には目次が入っていないので、ページの一覧を出しています。</p>
    <ol ref="list" class="toc">
      <li
        v-for="entry in entries"
        :key="entry.id"
        :class="{ current: entry.id === currentId }"
        :style="{ '--depth': entry.depth }"
      >
        <button class="title" type="button" :disabled="entry.pageNumber === null" @click="go(entry)">
          {{ entry.title }}
        </button>
        <span v-if="hasOutline" class="page num">{{ entry.pageNumber ?? '—' }}</span>
      </li>
    </ol>
  </template>
</template>

<style scoped>
.note,
.failed {
  padding: 0 6px 8px;
}

.failed {
  color: var(--warn-ink);
}

.toc {
  display: grid;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: baseline;
  padding: 3px 8px 3px calc(8px + var(--depth) * 14px);
  border-radius: 6px;
}

li.current {
  background: var(--ribbon-soft);
}

.title {
  padding: 1px 0;
  border: 0;
  background: transparent;
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
  cursor: pointer;
}

.title:hover,
li.current .title {
  color: var(--ink);
}

.title:disabled {
  color: var(--ink-3);
  cursor: default;
}

li.current .title {
  font-weight: 600;
}

.page {
  color: var(--ink-3);
  font-size: 11px;
}
</style>
