<script setup lang="ts">
import { Bookmark, Highlighter } from '@lucide/vue'
import type { SearchHit } from '../../lib/search'
import type { NoteHit } from '../../types/ui'
import HighlightQuote from '../common/HighlightQuote.vue'

const props = defineProps<{ noteHits: NoteHit[]; textHits: SearchHit[]; textLimit: number; active: number }>()
const emit = defineEmits<{ openNote: [hit: NoteHit]; openText: [hit: SearchHit]; hover: [index: number] }>()

const textIndex = (index: number) => props.noteHits.length + index
</script>

<template>
  <section v-if="noteHits.length > 0" aria-label="しおり・ハイライト">
    <h3>しおり・ハイライト <span class="num">{{ noteHits.length }}</span></h3>
    <button
      v-for="(hit, index) in noteHits"
      :key="hit.id"
      class="hit"
      type="button"
      :aria-selected="active === index"
      @click="emit('openNote', hit)"
      @mousemove="emit('hover', index)"
    >
      <span class="where">
        <Highlighter v-if="hit.kind === 'highlight'" :size="12" />
        <Bookmark v-else :size="12" />
        {{ hit.name }}<template v-if="hit.sectionTitle"> ・ {{ hit.sectionTitle }}</template>
      </span>
      <HighlightQuote v-if="hit.kind === 'highlight'" :text="hit.text" :color="hit.color" />
      <span v-else class="snippet">{{ hit.text }}</span>
      <span v-if="hit.memo" class="memo">{{ hit.memo }}</span>
    </button>
  </section>
  <section v-if="textHits.length > 0" aria-label="本文">
    <h3>本文 <span class="num">{{ textHits.length }}{{ textHits.length === textLimit ? ' 件以上' : ' 件' }}</span></h3>
    <button
      v-for="(hit, index) in textHits"
      :key="`${hit.path}:${hit.quote.start}`"
      class="hit"
      type="button"
      :aria-selected="active === textIndex(index)"
      @click="emit('openText', hit)"
      @mousemove="emit('hover', textIndex(index))"
    >
      <span class="where">{{ hit.name }}<template v-if="hit.sectionTitle"> ・ {{ hit.sectionTitle }}</template></span>
      <span class="snippet">…{{ hit.before }}<mark>{{ hit.match }}</mark>{{ hit.after }}…</span>
    </button>
  </section>
</template>

<style scoped>
section {
  display: grid;
  gap: 2px;
  padding-top: 8px;
}

h3 {
  margin: 4px 8px 4px;
  color: var(--ink-3);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.hit {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.hit[aria-selected='true'] {
  background: var(--ribbon-soft);
}

.where {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  overflow: hidden;
  color: var(--ink-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet {
  overflow: hidden;
  color: var(--ink);
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet mark {
  padding: 0 1px;
  border-radius: 2px;
  background: rgba(255, 214, 0, 0.45);
  color: inherit;
}

.memo {
  color: var(--ink-2);
  font-size: 12.5px;
}
</style>
