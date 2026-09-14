<script setup lang="ts">
import { NotebookPen } from '@lucide/vue'
import { computed } from 'vue'
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../../shared/constants'
import { useStudyStore } from '../../composables/useStudyStore'
import { swatchBackground } from '../../lib/highlightPainter'
import { colorTitle } from '../../lib/labels'
import type { SelectionDraft } from '../../types/ui'

const props = defineProps<{ draft: SelectionDraft }>()
const emit = defineEmits<{ pick: [color: HighlightColor]; memo: [] }>()
const store = useStudyStore()

const ROOM_ABOVE = 56

const placement = computed(() => {
  const above = props.draft.top > ROOM_ABOVE
  return {
    left: `${props.draft.x}px`,
    top: `${above ? props.draft.top : props.draft.bottom}px`,
    transform: above ? 'translate(-50%, calc(-100% - 10px))' : 'translate(-50%, 10px)',
  }
})
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="選んだ文章に色を付ける" :style="placement">
    <button
      v-for="color in HIGHLIGHT_COLORS"
      :key="color"
      class="dot"
      type="button"
      :style="{ background: swatchBackground(color) }"
      :aria-label="`${colorTitle(store.state.highlightColorNames, color)}で塗る`"
      :title="`${colorTitle(store.state.highlightColorNames, color)}で塗る`"
      @mousedown.prevent
      @click="emit('pick', color)"
    />
    <span class="sep" aria-hidden="true" />
    <button class="memo" type="button" @mousedown.prevent @click="emit('memo')">
      <NotebookPen :size="14" />メモを書く
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: 1px solid var(--rule);
  border-radius: 9px;
  background: var(--paper);
  box-shadow: var(--shadow);
  white-space: nowrap;
}

.dot {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 50%;
  cursor: pointer;
}

.dot:hover {
  transform: scale(1.12);
}

.sep {
  width: 1px;
  height: 16px;
  background: var(--rule);
}

.memo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  cursor: pointer;
}

.memo:hover {
  background: var(--ribbon-soft);
}
</style>
