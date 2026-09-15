<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { documentKindOf } from '../../shared/documentKind'

const props = defineProps<{ path: string; bookmarkId: string | null; highlightId: string | null }>()

// 資料の種類で閲覧画面を切り替える。種類は拡張子で決まるので、資料の一覧を待たずに選べる
const ReaderPage = defineAsyncComponent(() => import('./ReaderPage.vue'))
const PdfReaderPage = defineAsyncComponent(() => import('./PdfReaderPage.vue'))

const isPdf = computed(() => documentKindOf(props.path) === 'pdf')
</script>

<template>
  <PdfReaderPage v-if="isPdf" :path="path" />
  <ReaderPage v-else :path="path" :bookmark-id="bookmarkId" :highlight-id="highlightId" />
</template>
