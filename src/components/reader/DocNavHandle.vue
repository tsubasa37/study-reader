<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ x: number; width: number }>()
const emit = defineEmits<{ resize: [width: number]; commit: [width: number]; reset: [] }>()

const KEY_STEP = 16
const KEY_STEP_LARGE = 48

const dragging = ref(false)
let startX = 0
let startWidth = 0

// 教材（iframe）の上をドラッグしても追随するよう、つまみに pointer を捕まえておく
function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  startX = event.clientX
  startWidth = props.width
  dragging.value = true
  event.preventDefault()
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value) return
  emit('resize', startWidth + (event.clientX - startX))
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  const handle = event.currentTarget as HTMLElement
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  emit('commit', props.width)
}

function onKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
  if (event.key === 'ArrowLeft') emit('commit', props.width - step)
  else if (event.key === 'ArrowRight') emit('commit', props.width + step)
  else if (event.key === 'Home') emit('reset')
  else return
  event.preventDefault()
}
</script>

<template>
  <div
    class="handle"
    :class="{ dragging }"
    :style="{ left: `${x}px` }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="`教材の目次の幅 ${Math.round(width)}px（左右キーで調整、Home で元に戻す）`"
    :title="'ドラッグで教材の目次の幅を変える（ダブルクリックで元に戻す）'"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @keydown="onKeydown"
    @dblclick="emit('reset')"
  />
</template>

<style scoped>
.handle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 4;
  width: 11px;
  transform: translateX(-5px);
  cursor: col-resize;
}

.handle::before {
  content: '';
  position: absolute;
  inset: 0 4px;
  background: transparent;
  transition: background 0.15s;
}

.handle:hover::before,
.handle:focus-visible::before,
.handle.dragging::before {
  background: var(--ribbon);
}

.handle:focus-visible {
  outline: none;
}
</style>
