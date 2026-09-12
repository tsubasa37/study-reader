<script setup lang="ts">
import { Pencil } from '@lucide/vue'
import { nextTick, ref, useTemplateRef, watch } from 'vue'

const props = defineProps<{ memo: string; placeholder: string; focusRequested: boolean }>()
const emit = defineEmits<{ save: [memo: string] }>()

const editing = ref(false)
const draft = ref('')
const area = useTemplateRef<HTMLTextAreaElement>('area')

async function start(): Promise<void> {
  draft.value = props.memo
  editing.value = true
  await nextTick()
  area.value?.focus()
}

function save(): void {
  const memo = draft.value.trim()
  editing.value = false
  if (memo !== props.memo) emit('save', memo)
}

watch(
  () => props.focusRequested,
  (requested) => {
    if (requested) void start()
  },
  { immediate: true },
)
</script>

<template>
  <div class="note">
    <template v-if="editing">
      <textarea
        ref="area"
        v-model="draft"
        class="field"
        rows="3"
        :placeholder="placeholder"
        @keydown.meta.enter="save"
        @keydown.ctrl.enter="save"
        @keydown.esc="editing = false"
      />
      <div class="actions">
        <button class="btn btn-primary" type="button" @click="save">メモを保存</button>
        <button class="btn btn-ghost" type="button" @click="editing = false">やめる</button>
      </div>
    </template>
    <button v-else class="memo" type="button" @click="start">
      <span v-if="memo" class="text">{{ memo }}</span>
      <span v-else class="add"><Pencil :size="13" />メモを書く</span>
    </button>
  </div>
</template>

<style scoped>
.note {
  display: grid;
  gap: 6px;
}

textarea {
  resize: vertical;
  font-size: 13.5px;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 6px;
}

.memo {
  padding: 2px 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.text {
  color: var(--ink);
  font-size: 13.5px;
  white-space: pre-wrap;
}

.add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink-3);
  font-size: 12.5px;
}

.memo:hover .add {
  color: var(--ribbon);
}
</style>
