<script setup lang="ts">
import { Bookmark, CircleAlert, Highlighter } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatWhen } from '../../lib/format'
import type { NoteEntry } from '../../types/ui'
import HighlightQuote from '../common/HighlightQuote.vue'

const props = defineProps<{ entry: NoteEntry; openable: boolean }>()

const target = computed(() => ({ name: 'read', query: { path: props.entry.path, [props.entry.kind]: props.entry.id } }))
</script>

<template>
  <li class="note-item card">
    <component :is="openable ? RouterLink : 'div'" class="note-go" v-bind="openable ? { to: target } : {}">
      <span class="note-where">
        <Highlighter v-if="entry.kind === 'highlight'" :size="12" />
        <Bookmark v-else :size="12" />
        {{ entry.sectionTitle ?? '章の区切りなし' }}
      </span>
      <HighlightQuote v-if="entry.kind === 'highlight' && entry.color" :text="entry.text" :color="entry.color" />
      <span v-else class="excerpt">{{ entry.text || '（本文の抜き出しなし）' }}</span>
    </component>
    <p v-if="entry.memo" class="memo">{{ entry.memo }}</p>
    <div class="note-meta">
      <span class="num">{{ formatWhen(entry.createdAt) }}</span>
      <span v-if="entry.lost" class="lost"><CircleAlert :size="12" />位置を見失った</span>
    </div>
  </li>
</template>

<style scoped>
.card .note-go {
  color: inherit;
  text-decoration: none;
}

.note-where {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}

.excerpt {
  color: var(--ink);
  font-size: 13.5px;
}

.memo {
  margin: 0;
  padding-left: 10px;
  border-left: 2px solid var(--rule);
  color: var(--ink);
  font-size: 13.5px;
  white-space: pre-wrap;
}

.lost {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--warn-ink);
}
</style>
