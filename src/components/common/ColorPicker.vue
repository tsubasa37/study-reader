<script setup lang="ts">
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_LABELS, type HighlightColor } from '../../../shared/constants'
import { swatchBackground } from '../../lib/highlightPainter'

defineProps<{ value: HighlightColor }>()
const emit = defineEmits<{ change: [color: HighlightColor] }>()
</script>

<template>
  <div class="colors" role="group" aria-label="色を変える">
    <button
      v-for="color in HIGHLIGHT_COLORS"
      :key="color"
      type="button"
      :style="{ background: swatchBackground(color) }"
      :aria-pressed="color === value"
      :aria-label="`${HIGHLIGHT_COLOR_LABELS[color]}に変える`"
      @click="emit('change', color)"
    />
  </div>
</template>

<style scoped>
.colors {
  display: flex;
  gap: 8px;
}

button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ink) 22%, transparent);
  border-radius: 50%;
  cursor: pointer;
}

button[aria-pressed='true'] {
  outline: 2px solid var(--ribbon);
  outline-offset: 2px;
}
</style>
