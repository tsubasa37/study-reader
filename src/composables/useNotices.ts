import { ref } from 'vue'

export type Notice = {
  id: number
  kind: 'error' | 'info'
  message: string
}

const INFO_DURATION_MS = 6000

const notices = ref<Notice[]>([])
let nextId = 1

function push(kind: Notice['kind'], message: string): void {
  const id = nextId++
  notices.value = [...notices.value, { id, kind, message }]
  if (kind === 'info') setTimeout(() => dismissNotice(id), INFO_DURATION_MS)
}

export function dismissNotice(id: number): void {
  notices.value = notices.value.filter((notice) => notice.id !== id)
}

export function reportError(error: unknown): void {
  console.error(error)
  push('error', error instanceof Error ? error.message : String(error))
}

export function notify(message: string): void {
  push('info', message)
}

export function useNotices() {
  return { notices, dismiss: dismissNotice }
}
