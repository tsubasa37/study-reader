<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { DocumentEntry } from '../../../shared/types'
import { notify } from '../../composables/useNotices'
import { useStudyStore } from '../../composables/useStudyStore'
import { suggestMoveTarget } from '../../lib/projects'
import type { OrphanRecord } from '../../types/ui'

const props = defineProps<{ records: OrphanRecord[]; documents: DocumentEntry[] }>()

const store = useStudyStore()
const targets = reactive<Record<string, string>>({})

// 同じファイル名が1つだけ見つかったときだけ、引き継ぎ先の候補として選んでおく（勝手には実行しない）
const suggestions = computed(() =>
  Object.fromEntries(props.records.map((record) => [record.path, suggestMoveTarget(record.path, props.documents)])),
)

const targetOf = (record: OrphanRecord): string => targets[record.path] ?? suggestions.value[record.path] ?? ''

const describe = (record: OrphanRecord) =>
  `進み具合 ${record.hasProgress ? 'あり' : 'なし'} ・ しおり ${record.bookmarks} 件 ・ ハイライト ${record.highlights} 件`

async function move(record: OrphanRecord): Promise<void> {
  const from = record.path
  const to = targetOf(record)
  if (to === '') return
  const summary = await store.moveRecords({ from, to })
  notify(`${to} へ、しおり ${summary.bookmarks} 件・ハイライト ${summary.highlights} 件を引き継ぎました`)
}

async function discard(record: OrphanRecord): Promise<void> {
  if (!window.confirm(`${record.path} の記録（${describe(record)}）を消します。元に戻せません。よろしいですか？`)) return
  await store.deleteRecords(record.path)
  notify(`${record.path} の記録を消しました`)
}
</script>

<template>
  <details class="orphans">
    <summary>記録だけ残っている資料 <span class="num">{{ records.length }}</span></summary>
    <p class="explain">
      名前を変えた・移動した・消した資料の記録です。そのままにしておいても問題ありません。今のファイルに結び付け直すことも、記録を消すこともできます。
    </p>
    <ul>
      <li v-for="record in records" :key="record.path">
        <div class="what">
          <strong>{{ record.path }}</strong>
          <span class="num">{{ describe(record) }}</span>
        </div>
        <div class="choose">
          <select
            class="field"
            :value="targetOf(record)"
            :aria-label="`${record.path} の引き継ぎ先`"
            @change="targets[record.path] = ($event.target as HTMLSelectElement).value"
          >
            <option value="">引き継ぎ先を選ぶ</option>
            <option v-for="document in documents" :key="document.path" :value="document.path">{{ document.path }}</option>
          </select>
          <span v-if="targets[record.path] === undefined && suggestions[record.path]" class="hint">
            同じ名前のファイルが見つかりました（フォルダへ移した資料はこれで引き継げます）
          </span>
        </div>
        <button class="btn btn-primary" type="button" :disabled="targetOf(record) === ''" @click="move(record)">引き継ぐ</button>
        <button class="btn btn-ghost btn-danger" type="button" @click="discard(record)">記録を消す</button>
      </li>
    </ul>
  </details>
</template>

<style scoped>
.orphans {
  padding: 12px 16px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--paper);
}

summary {
  color: var(--ink-2);
  font-size: 13px;
  cursor: pointer;
}

summary .num {
  color: var(--ink-3);
}

.orphans[open] summary {
  margin-bottom: 10px;
}

.explain {
  margin: 0;
  color: var(--ink-2);
  font-size: 13px;
}

ul {
  display: grid;
  gap: 10px;
  margin-top: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 260px) auto auto;
  gap: 10px;
  align-items: center;
}

.what {
  display: grid;
  min-width: 0;
}

.choose {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.hint {
  color: var(--ink-3);
  font-size: 11.5px;
}

.what strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.what span {
  color: var(--ink-2);
  font-size: 12px;
}

@media (max-width: 720px) {
  li {
    grid-template-columns: 1fr;
  }
}
</style>
