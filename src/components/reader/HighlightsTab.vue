<script setup lang="ts">
import { CircleAlert, Trash2 } from '@lucide/vue'
import type { Highlight, HighlightColor } from '../../../shared/types'
import { formatWhen } from '../../lib/format'
import ColorPicker from '../common/ColorPicker.vue'
import HighlightQuote from '../common/HighlightQuote.vue'
import NoteEditor from '../common/NoteEditor.vue'

defineProps<{ items: Highlight[]; lost: Highlight[]; activeId: string | null; editId: string | null }>()
const emit = defineEmits<{
  go: [id: string]
  saveMemo: [id: string, memo: string]
  recolor: [id: string, color: HighlightColor]
  remove: [id: string]
}>()
</script>

<template>
  <p v-if="items.length + lost.length === 0" class="empty">本文の文章をなぞって選ぶと、色を付けてメモを書けます。</p>
  <ul v-if="items.length > 0" class="note-list">
    <li v-for="item in items" :key="item.id" class="note-item" :class="{ active: item.id === activeId }">
      <button class="note-go" type="button" @click="emit('go', item.id)">
        <span class="note-where">{{ item.sectionTitle ?? '章の区切りなし' }}</span>
        <HighlightQuote :text="item.quote.exact" :color="item.color" />
      </button>
      <ColorPicker v-if="item.id === activeId" :value="item.color" @change="(color) => emit('recolor', item.id, color)" />
      <NoteEditor
        :memo="item.memo"
        :focus-requested="item.id === editId"
        placeholder="気づいたこと・疑問"
        @save="(memo) => emit('saveMemo', item.id, memo)"
      />
      <div class="note-meta">
        <span class="num">{{ formatWhen(item.createdAt) }}</span>
        <button class="btn btn-ghost btn-danger" type="button" @click="emit('remove', item.id)"><Trash2 :size="13" />消す</button>
      </div>
    </li>
  </ul>
  <section v-if="lost.length > 0" class="lost" aria-labelledby="lost-title">
    <h3 id="lost-title"><CircleAlert :size="14" />位置を見失ったハイライト {{ lost.length }}</h3>
    <p>教材が書き換えられ、この文章が見つかりませんでした。記録は残してあります。</p>
    <ul class="note-list">
      <li v-for="item in lost" :key="item.id" class="note-item">
        <span class="note-where">{{ item.sectionTitle ?? '章の区切りなし' }}</span>
        <HighlightQuote :text="item.quote.exact" :color="item.color" />
        <span v-if="item.memo" class="lost-memo">{{ item.memo }}</span>
        <div class="note-meta">
          <span class="num">{{ formatWhen(item.createdAt) }}</span>
          <button class="btn btn-ghost btn-danger" type="button" @click="emit('remove', item.id)"><Trash2 :size="13" />消す</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.lost {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.lost h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--warn-ink);
  font-size: 13px;
}

.lost p {
  margin: 0;
  color: var(--ink-2);
  font-size: 12.5px;
}

.lost-memo {
  font-size: 13px;
  white-space: pre-wrap;
}
</style>
