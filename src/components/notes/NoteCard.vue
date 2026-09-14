<script setup lang="ts">
import { CircleAlert, Highlighter } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useStudyStore } from '../../composables/useStudyStore'
import { formatWhen } from '../../lib/format'
import { swatchBackground } from '../../lib/highlightPainter'
import { NO_SECTION } from '../../lib/labels'
import type { NoteListEntry } from '../../types/ui'
import HighlightQuote from '../common/HighlightQuote.vue'

const props = defineProps<{ entry: NoteListEntry }>()
const store = useStudyStore()

const target = computed(() => ({ name: 'read', query: { path: props.entry.path, highlight: props.entry.id } }))
</script>

<template>
  <li class="note-item card">
    <RouterLink class="note-go" :to="target">
      <span class="note-where">
        <Highlighter :size="12" />
        {{ entry.sectionTitle ?? NO_SECTION }}
      </span>
      <HighlightQuote v-if="entry.color" :text="entry.text" :color="entry.color" />
    </RouterLink>
    <p v-if="entry.memo" class="memo">{{ entry.memo }}</p>
    <div class="note-meta">
      <span class="when">
        <span class="num">{{ formatWhen(entry.createdAt) }}</span>
        <span v-if="entry.color" class="color-name">
          <span class="swatch" :style="{ background: swatchBackground(entry.color) }" />
          {{ store.state.highlightColorNames[entry.color] }}
        </span>
      </span>
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

.memo {
  margin: 0;
  padding-left: 10px;
  border-left: 2px solid var(--rule);
  color: var(--ink);
  font-size: 13.5px;
  white-space: pre-wrap;
}

.when,
.color-name {
  display: inline-flex;
  align-items: center;
}

.when {
  gap: 12px;
}

.color-name {
  gap: 5px;
  color: var(--ink-2);
}

.lost {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--warn-ink);
}
</style>
