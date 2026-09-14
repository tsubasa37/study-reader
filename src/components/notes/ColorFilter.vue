<script setup lang="ts">
import { Pencil } from '@lucide/vue'
import { ref } from 'vue'
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../../shared/constants'
import { useStudyStore } from '../../composables/useStudyStore'
import { swatchBackground } from '../../lib/highlightPainter'
import { colorTitle } from '../../lib/labels'
import type { ColorCounts } from '../../types/ui'
import ColorNamesEditor from './ColorNamesEditor.vue'

defineProps<{ counts: ColorCounts }>()
const color = defineModel<HighlightColor | null>({ required: true })
const store = useStudyStore()
const editing = ref(false)
</script>

<template>
  <div class="color-filter">
    <div class="chips" role="group" aria-label="色の名前で絞り込む">
      <button class="chip" type="button" :aria-pressed="color === null" @click="color = null">
        すべて<span class="num">{{ counts.all }}</span>
      </button>
      <button
        v-for="item in HIGHLIGHT_COLORS"
        :key="item"
        class="chip"
        type="button"
        :title="colorTitle(store.state.highlightColorNames, item)"
        :aria-pressed="color === item"
        @click="color = color === item ? null : item"
      >
        <span class="swatch" :style="{ background: swatchBackground(item) }" />
        {{ store.state.highlightColorNames[item] }}<span class="num">{{ counts[item] }}</span>
      </button>
      <button class="btn btn-ghost rename" type="button" :aria-expanded="editing" @click="editing = !editing">
        <Pencil :size="13" />色の名前を変える
      </button>
    </div>
    <ColorNamesEditor v-if="editing" @close="editing = false" />
  </div>
</template>

<style scoped>
.color-filter {
  display: grid;
  gap: 10px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 3px 10px;
  border: 1px solid var(--rule);
  border-radius: 99px;
  background: var(--sheet);
  color: var(--ink-2);
  font-size: 12.5px;
  line-height: 1.6;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--ink-3);
  color: var(--ink);
}

.chip[aria-pressed='true'] {
  border-color: var(--ribbon);
  box-shadow: inset 0 0 0 1px var(--ribbon);
  color: var(--ink);
}

.chip .num {
  color: var(--ink-3);
  font-size: 11px;
}

.rename {
  margin-left: auto;
  padding: 3px 8px;
  font-size: 12.5px;
}
</style>
