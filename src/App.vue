<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import NoticeStack from './components/common/NoticeStack.vue'
import SearchDialog from './components/search/SearchDialog.vue'
import { reportError } from './composables/useNotices'
import { useSearchDialog } from './composables/useSearchDialog'
import { loadStudyState } from './composables/useStudyStore'
import { isSearchShortcut } from './lib/shortcuts'

const search = useSearchDialog()

function onKeydown(event: KeyboardEvent): void {
  if (!isSearchShortcut(event)) return
  event.preventDefault()
  search.show()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  loadStudyState().catch(reportError)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" :key="route.name === 'read' ? `read:${String(route.query.path)}` : String(route.name)" />
  </RouterView>
  <SearchDialog v-if="search.open.value" @close="search.close" />
  <NoticeStack />
</template>
