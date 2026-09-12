<script setup lang="ts">
import { Check, Ellipsis, FolderPlus } from '@lucide/vue'
import { nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'

const props = defineProps<{ name: string; folders: string[]; current: string }>()
const emit = defineEmits<{ move: [folder: string] }>()

const open = ref(false)
const newName = ref('')
const menu = useTemplateRef<HTMLDivElement>('menu')

function close(): void {
  open.value = false
  newName.value = ''
  window.removeEventListener('pointerdown', onOutside, true)
}

function onOutside(event: PointerEvent): void {
  if (!menu.value?.contains(event.target as Node)) close()
}

async function toggle(): Promise<void> {
  if (open.value) {
    close()
    return
  }
  open.value = true
  await nextTick()
  window.addEventListener('pointerdown', onOutside, true)
}

function choose(folder: string): void {
  close()
  emit('move', folder)
}

function createProject(): void {
  const folder = newName.value.trim()
  if (folder === '') return
  choose(folder)
}

onBeforeUnmount(() => window.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <div ref="menu" class="move" @keydown.esc="close">
    <button
      class="icon-button"
      type="button"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="`${name} をプロジェクトに移動`"
      title="プロジェクトに移動"
      @click="toggle"
    >
      <Ellipsis :size="16" />
    </button>
    <div v-if="open" class="menu" role="menu">
      <p class="title">プロジェクトに移動</p>
      <button
        v-for="folder in folders"
        :key="folder"
        class="item"
        type="button"
        role="menuitem"
        :disabled="folder === current"
        @click="choose(folder)"
      >
        <Check v-if="folder === current" :size="13" /><span v-else class="mark" />{{ folder }}
      </button>
      <button v-if="current !== ''" class="item" type="button" role="menuitem" @click="choose('')">
        <span class="mark" />プロジェクトから出す
      </button>
      <form class="new" @submit.prevent="createProject">
        <FolderPlus :size="14" />
        <input v-model="newName" class="field" placeholder="新しいプロジェクト名" aria-label="新しいプロジェクト名" />
        <button class="btn" type="submit" :disabled="newName.trim() === ''">作る</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.move {
  position: relative;
  padding-left: 6px;
}

.icon-button {
  border-color: transparent;
  color: var(--ink-3);
}

.menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  display: grid;
  gap: 1px;
  width: 260px;
  padding: 8px;
  border: 1px solid var(--rule);
  border-radius: 9px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.title {
  margin: 0 0 4px;
  padding: 0 6px;
  color: var(--ink-3);
  font-size: 11.5px;
  letter-spacing: 0.06em;
}

.item {
  display: flex;
  gap: 6px;
  align-items: center;
  overflow: hidden;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.item:hover:not(:disabled) {
  background: var(--ribbon-soft);
}

.item:disabled {
  color: var(--ink-3);
  cursor: default;
}

.mark {
  width: 13px;
}

.new {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--rule);
  color: var(--ink-3);
}

.new .field {
  min-width: 0;
  padding: 5px 8px;
  font-size: 13px;
}
</style>
