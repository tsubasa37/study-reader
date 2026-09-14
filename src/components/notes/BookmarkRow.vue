<script setup lang="ts">
import { ArrowRight, Bookmark } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatWhen } from '../../lib/format'
import { NO_EXCERPT, NO_SECTION } from '../../lib/labels'
import type { NoteHit } from '../../types/ui'

const props = defineProps<{ entry: NoteHit }>()

const target = computed(() => ({ name: 'read', query: { path: props.entry.path, bookmark: props.entry.id } }))
</script>

<template>
  <li class="bookmark-row">
    <RouterLink class="go" :to="target">
      <Bookmark class="icon" :size="15" />
      <span class="body">
        <span class="where">{{ entry.name }} › {{ entry.sectionTitle ?? NO_SECTION }}</span>
        <span class="excerpt">{{ entry.text || NO_EXCERPT }}</span>
        <span v-if="entry.memo" class="memo">{{ entry.memo }}</span>
      </span>
      <span class="when num">{{ formatWhen(entry.createdAt) }}</span>
      <span class="resume">続きから<ArrowRight :size="13" /></span>
    </RouterLink>
  </li>
</template>

<style scoped>
.bookmark-row + .bookmark-row {
  border-top: 1px solid var(--rule);
}

.go {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 16px;
  align-items: center;
  padding: 11px 16px;
  color: var(--ink);
  text-decoration: none;
}

.go:hover {
  background: color-mix(in srgb, var(--ribbon-soft) 55%, transparent);
}

.icon {
  color: var(--ribbon);
}

.body {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.where,
.excerpt,
.memo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.where,
.when {
  color: var(--ink-3);
  font-size: 11.5px;
}

.excerpt {
  font-size: 13.5px;
}

.memo {
  color: var(--ink-2);
  font-size: 12.5px;
}

.resume {
  display: inline-flex;
  gap: 3px;
  align-items: center;
  color: var(--ribbon);
  font-size: 12.5px;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .go {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .when,
  .resume {
    grid-column: 2;
  }
}
</style>
