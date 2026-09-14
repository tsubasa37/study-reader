<script setup lang="ts">
import { computed, ref } from 'vue'
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_LABELS, HIGHLIGHT_COLOR_NAME_MAX } from '../../../shared/constants'
import type { HighlightColorNames } from '../../../shared/types'
import { reportError } from '../../composables/useNotices'
import { useStudyStore } from '../../composables/useStudyStore'
import { swatchBackground } from '../../lib/highlightPainter'

const emit = defineEmits<{ close: [] }>()
const store = useStudyStore()

const draft = ref<HighlightColorNames>({ ...store.state.highlightColorNames })
const saving = ref(false)
const filled = computed(() => HIGHLIGHT_COLORS.every((color) => draft.value[color].trim() !== ''))

async function save(): Promise<void> {
  saving.value = true
  try {
    await store.saveHighlightColorNames(draft.value)
    emit('close')
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="names" aria-label="色の名前" @submit.prevent="save" @keydown.esc="emit('close')">
    <div class="rows">
      <label v-for="color in HIGHLIGHT_COLORS" :key="color" class="row">
        <span class="swatch" :style="{ background: swatchBackground(color) }" />
        <span class="hue">{{ HIGHLIGHT_COLOR_LABELS[color] }}</span>
        <input v-model="draft[color]" class="field" type="text" :maxlength="HIGHLIGHT_COLOR_NAME_MAX" required />
      </label>
    </div>
    <p class="hint">名前を変えても、付けたハイライトの色はそのままです。色が表す意味だけが変わります。</p>
    <div class="actions">
      <button class="btn btn-primary" type="submit" :disabled="!filled || saving">名前を保存</button>
      <button class="btn btn-ghost" type="button" @click="emit('close')">やめる</button>
    </div>
  </form>
</template>

<style scoped>
.names {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--sheet);
}

.rows {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
}

.row {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.swatch {
  width: 14px;
  height: 14px;
}

.hue {
  color: var(--ink-3);
  font-size: 12px;
}

.field {
  padding: 5px 9px;
  font-size: 13.5px;
}

.hint {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 720px) {
  .rows {
    grid-template-columns: 1fr;
  }
}
</style>
