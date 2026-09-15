<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePendingJump } from '../../composables/usePendingJump'
import { useSearchIndex } from '../../composables/useSearchIndex'
import { loadStudyState, useStudyStore } from '../../composables/useStudyStore'
import { searchDocuments, type SearchHit } from '../../lib/search'
import type { NoteHit } from '../../types/ui'
import SearchResults from './SearchResults.vue'
import { findNoteHits } from './noteHits'

const emit = defineEmits<{ close: [] }>()
const TEXT_LIMIT = 80

const router = useRouter()
const store = useStudyStore()
const jump = usePendingJump()
const { indexed, indexing, ensureIndex } = useSearchIndex()
const query = ref('')
const active = ref(0)
const input = useTemplateRef<HTMLInputElement>('input')
const results = useTemplateRef<HTMLDivElement>('results')

const textHits = computed(() => searchDocuments(indexed.value, query.value).slice(0, TEXT_LIMIT))
const noteHits = computed(() => findNoteHits(store, query.value))
const total = computed(() => noteHits.value.length + textHits.value.length)

watch(query, () => {
  active.value = 0
})

onMounted(async () => {
  input.value?.focus()
  await loadStudyState()
  await ensureIndex(store.state.documents)
})

function openText(hit: SearchHit): void {
  jump.request({ path: hit.path, quote: hit.quote })
  emit('close')
  void router.push({ name: 'read', query: { path: hit.path } })
}

function openNote(hit: NoteHit): void {
  emit('close')
  void router.push({ name: 'read', query: { path: hit.path, [hit.kind]: hit.id } })
}

function openActive(): void {
  const note = noteHits.value[active.value]
  if (note !== undefined) return openNote(note)
  const text = textHits.value[active.value - noteHits.value.length]
  if (text !== undefined) openText(text)
}

async function move(delta: number): Promise<void> {
  if (total.value === 0) return
  active.value = (active.value + delta + total.value) % total.value
  await nextTick()
  results.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <div class="overlay" @mousedown.self="emit('close')">
    <div class="search-dialog" role="dialog" aria-modal="true" aria-label="全教材を検索">
      <div class="input-row">
        <Search :size="18" />
        <input
          ref="input"
          v-model="query"
          type="search"
          placeholder="教材の本文・しおり・ハイライトのメモを検索"
          aria-label="検索する言葉"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="openActive"
          @keydown.esc="emit('close')"
        />
        <button class="icon-button" type="button" aria-label="閉じる" @click="emit('close')"><X :size="16" /></button>
      </div>
      <div ref="results" class="results">
        <p v-if="query.trim() === ''" class="hint">
          {{ indexing ? '教材を読み込んでいます…' : `${indexed.length} 冊の本文と、しおり・ハイライトのメモから探します。` }}
          ↑↓ で選び、Enter で開きます。
        </p>
        <p v-else-if="total === 0" class="hint">{{ indexing ? '教材を読み込んでいます…' : '見つかりませんでした' }}</p>
        <SearchResults
          v-else
          :note-hits="noteHits"
          :text-hits="textHits"
          :text-limit="TEXT_LIMIT"
          :active="active"
          @open-note="openNote"
          @open-text="openText"
          @hover="(index) => (active = index)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  justify-items: center;
  align-items: start;
  padding-top: 11vh;
  background: color-mix(in srgb, var(--ink) 28%, transparent);
}

.search-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(760px, calc(100vw - 32px));
  max-height: 72vh;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.input-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--rule);
  color: var(--ink-3);
}

input {
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 16px;
  outline: none;
}

.results {
  overflow-y: auto;
  padding: 6px 8px 12px;
}

.hint {
  margin: 12px 8px;
  color: var(--ink-3);
  font-size: 13px;
}
</style>
