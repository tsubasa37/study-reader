<script setup lang="ts">
import { CircleAlert, Info, X } from '@lucide/vue'
import { useNotices } from '../../composables/useNotices'

const { notices, dismiss } = useNotices()
</script>

<template>
  <div class="stack" aria-live="polite">
    <div v-for="notice in notices" :key="notice.id" class="notice" :class="notice.kind" :role="notice.kind === 'error' ? 'alert' : 'status'">
      <CircleAlert v-if="notice.kind === 'error'" :size="16" />
      <Info v-else :size="16" />
      <p>{{ notice.message }}</p>
      <button class="close" type="button" aria-label="閉じる" @click="dismiss(notice.id)"><X :size="14" /></button>
    </div>
  </div>
</template>

<style scoped>
.stack {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 50;
  display: grid;
  gap: 8px;
  width: min(420px, calc(100vw - 32px));
}

.notice {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: var(--shadow);
  font-size: 13.5px;
}

.notice.error {
  border-color: color-mix(in srgb, var(--danger) 40%, transparent);
  background: var(--danger-soft);
  color: var(--danger);
}

.notice p {
  margin: 0;
  color: var(--ink);
  white-space: pre-wrap;
}

.close {
  padding: 2px;
  border: 0;
  background: transparent;
  color: var(--ink-3);
  cursor: pointer;
}
</style>
