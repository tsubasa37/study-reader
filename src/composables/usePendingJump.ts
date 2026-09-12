import { shallowRef } from 'vue'
import type { JumpTarget } from '../types/ui'

const pending = shallowRef<JumpTarget | null>(null)

// 検索結果から閲覧画面へ「この文章の位置へ飛ぶ」を渡す
export function usePendingJump() {
  return {
    pending,
    request(target: JumpTarget): void {
      pending.value = target
    },
    take(path: string): JumpTarget | null {
      const target = pending.value
      if (target === null || target.path !== path) return null
      pending.value = null
      return target
    },
  }
}
