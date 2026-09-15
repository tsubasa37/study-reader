<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { DocumentEntry, DocumentProgress } from '../../../shared/types'
import { formatWhen } from '../../lib/format'
import { NO_SECTION } from '../../lib/labels'
import { summarizeProgress } from '../../lib/progressSummary'

const props = defineProps<{ document: DocumentEntry; progress: DocumentProgress }>()
const summary = computed(() => summarizeProgress(props.progress))
</script>

<template>
  <RouterLink class="resume" :to="{ name: 'read', query: { path: document.path } }">
    <span class="ribbon" aria-hidden="true" />
    <span class="label">前回の続き</span>
    <strong class="title">{{ document.name }}<span v-if="document.kind === 'pdf'" class="kind-tag">PDF</span></strong>
    <span class="where">{{ progress.sectionTitle ?? NO_SECTION }}</span>
    <span class="meta num">{{ formatWhen(progress.lastOpenedAt) }} ・ {{ summary.label }}</span>
    <span class="btn btn-primary">続きから読む</span>
  </RouterLink>
</template>

<style scoped>
.resume {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 22px 26px 24px;
  border: 1px solid var(--rule);
  border-radius: 10px;
  background: var(--sheet);
  box-shadow: var(--shadow);
  color: var(--ink);
  text-decoration: none;
}

.resume:hover .btn {
  filter: brightness(1.08);
}

.resume .ribbon {
  position: absolute;
  top: -1px;
  right: 32px;
  width: 16px;
  height: 46px;
}

.label {
  color: var(--ribbon);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.14em;
}

.title {
  font: 600 24px/1.4 var(--f-display);
  text-wrap: balance;
}

.title .kind-tag {
  margin-left: 10px;
  vertical-align: 0.35em;
}

.where {
  color: var(--ink-2);
  font-size: 15px;
}

.meta {
  color: var(--ink-3);
  font-size: 12.5px;
}

.btn {
  justify-self: start;
  margin-top: 12px;
}
</style>
