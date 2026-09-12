<script setup lang="ts">
import { Check } from '@lucide/vue'
import { nextTick, useTemplateRef, watch } from 'vue'
import type { TocEntry } from '../../types/ui'

const props = defineProps<{ entries: TocEntry[] }>()
const emit = defineEmits<{ go: [id: string]; toggleRead: [id: string, read: boolean] }>()
const list = useTemplateRef<HTMLOListElement>('list')

watch(
  () => props.entries.find((entry) => entry.current)?.id,
  async () => {
    await nextTick()
    list.value?.querySelector('.current')?.scrollIntoView({ block: 'nearest' })
  },
)
</script>

<template>
  <p v-if="entries.length === 0" class="empty">この教材には章の区切り（id 付きの section）がありません。</p>
  <ol v-else ref="list" class="toc">
    <li v-for="entry in entries" :key="entry.id" :class="{ current: entry.current }" :style="{ '--depth': entry.depth }">
      <button
        v-if="entry.isLeaf"
        class="check"
        type="button"
        :aria-pressed="entry.read"
        :aria-label="entry.read ? `${entry.title}を未読に戻す` : `${entry.title}を読んだことにする`"
        @click="emit('toggleRead', entry.id, !entry.read)"
      >
        <Check v-if="entry.read" :size="13" />
      </button>
      <span v-else class="check" aria-hidden="true" />
      <button class="title" type="button" @click="emit('go', entry.id)">{{ entry.title }}</button>
      <span v-if="entry.current" class="ribbon" aria-hidden="true" />
    </li>
  </ol>
</template>

<style scoped>
.toc {
  display: grid;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 6px;
  align-items: start;
  padding: 3px 22px 3px calc(6px + var(--depth) * 14px);
  border-radius: 6px;
}

li.current {
  background: var(--ribbon-soft);
}

.check {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-top: 3px;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--sheet);
  color: var(--ribbon);
  cursor: pointer;
}

span.check {
  border-color: transparent;
  background: transparent;
  cursor: default;
}

.check[aria-pressed='true'] {
  border-color: var(--ribbon);
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

li.current .title {
  font-weight: 600;
}

li .ribbon {
  position: absolute;
  top: 0;
  right: 8px;
  width: 8px;
  height: 20px;
}
</style>
