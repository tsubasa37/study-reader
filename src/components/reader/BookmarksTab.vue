<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import type { Bookmark } from '../../../shared/types'
import { formatWhen } from '../../lib/format'
import NoteEditor from '../common/NoteEditor.vue'

defineProps<{ items: Bookmark[]; activeId: string | null; editId: string | null }>()
const emit = defineEmits<{ go: [id: string]; saveMemo: [id: string, memo: string]; remove: [id: string] }>()
</script>

<template>
  <p v-if="items.length === 0" class="empty">まだしおりはありません。上の「しおりを挟む」で今読んでいる位置を残せます。</p>
  <ul v-else class="note-list">
    <li v-for="item in items" :key="item.id" class="note-item" :class="{ active: item.id === activeId }">
      <button class="note-go" type="button" @click="emit('go', item.id)">
        <span class="note-where">{{ item.sectionTitle ?? '章の区切りなし' }}</span>
        <span class="excerpt">{{ item.excerpt || '（本文の抜き出しなし）' }}</span>
      </button>
      <NoteEditor
        :memo="item.memo"
        :focus-requested="item.id === editId"
        placeholder="なぜここに挟んだか（例: ここから復習）"
        @save="(memo) => emit('saveMemo', item.id, memo)"
      />
      <div class="note-meta">
        <span class="num">{{ formatWhen(item.createdAt) }}</span>
        <button class="btn btn-ghost btn-danger" type="button" @click="emit('remove', item.id)">
          <Trash2 :size="13" />外す
        </button>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.excerpt {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink);
  font-size: 13.5px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style>
