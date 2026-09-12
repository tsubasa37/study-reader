<script setup lang="ts">
import { Search } from '@lucide/vue'
</script>

<template>
  <button class="search-button" type="button">
    <Search :size="15" />
    <span>全教材を検索</span>
    <kbd>⌘K</kbd>
  </button>
</template>

<style scoped>
.search-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 210px;
  padding: 5px 8px 5px 10px;
  border: 1px solid var(--rule);
  border-radius: 7px;
  background: var(--sheet);
  color: var(--ink-3);
  font-size: 13px;
  cursor: pointer;
}

.search-button:hover {
  border-color: var(--ink-3);
  color: var(--ink-2);
}

kbd {
  margin-left: auto;
  padding: 1px 5px;
  border: 1px solid var(--rule);
  border-radius: 4px;
  font: 11px/1.4 var(--f-mono);
}
</style>
