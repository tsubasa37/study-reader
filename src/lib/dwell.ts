// 1回に足す滞在時間の上限。離席していた時間を丸ごと「読んでいた」と数えない
export const MAX_DWELL_STEP_MS = 5000

// 章ごとの滞在時間を測る。通り過ぎただけの章を既読にしないために使う
export class DwellTracker {
  private readonly totals = new Map<string, number>()
  private current: string | null = null
  private since = 0
  private paused = false

  constructor(private readonly maxStepMs: number = MAX_DWELL_STEP_MS) {}

  start(now: number): void {
    this.totals.clear()
    this.current = null
    this.since = now
    this.paused = false
  }

  // 今いる章を伝える。前の章にはここまでの滞在を足す
  move(sectionId: string | null, now: number): ReadonlyMap<string, number> {
    if (this.current !== null && !this.paused) {
      const elapsed = Math.min(Math.max(0, now - this.since), this.maxStepMs)
      this.totals.set(this.current, (this.totals.get(this.current) ?? 0) + elapsed)
    }
    this.current = sectionId
    this.since = now
    this.paused = false
    return this.totals
  }

  // 画面を見ていない間は数えない
  pause(now: number): void {
    this.move(this.current, now)
    this.paused = true
  }

  resume(now: number): void {
    this.since = now
    this.paused = false
  }
}
