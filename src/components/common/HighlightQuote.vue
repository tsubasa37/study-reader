<script setup lang="ts">
import type { HighlightColor } from '../../../shared/types'
import { HIGHLIGHT_BACKGROUNDS } from '../../lib/highlightPainter'

defineProps<{ text: string; color: HighlightColor }>()
</script>

<template>
  <span class="quote"><mark :style="{ background: HIGHLIGHT_BACKGROUNDS[color] }">{{ text }}</mark></span>
</template>

<style scoped>
.quote {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink);
  font-size: 13.5px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

mark {
  padding: 1px 2px;
  border-radius: 2px;
  color: inherit;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
</style>
