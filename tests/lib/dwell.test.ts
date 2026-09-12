import { describe, expect, it } from 'vitest'
import { DwellTracker } from '../../src/lib/dwell'

describe('DwellTracker', () => {
  it('章ごとに滞在時間を足す', () => {
    const tracker = new DwellTracker()
    tracker.start(0)

    tracker.move('ch1', 0)
    tracker.move('ch2', 3000)
    const totals = tracker.move('ch1', 4000)

    expect(Object.fromEntries(totals)).toEqual({ ch1: 3000, ch2: 1000 })
  })

  it('1回に足す時間には上限がある（離席していた分を数えない）', () => {
    const tracker = new DwellTracker(5000)
    tracker.start(0)

    tracker.move('ch1', 0)
    const totals = tracker.move('ch2', 600000)

    expect(totals.get('ch1')).toBe(5000)
  })

  it('画面を見ていない間は数えない', () => {
    const tracker = new DwellTracker()
    tracker.start(0)
    tracker.move('ch1', 0)

    tracker.pause(2000)
    tracker.resume(500000)
    const totals = tracker.move('ch2', 501000)

    expect(totals.get('ch1')).toBe(3000)
  })

  it('開き直すと今までの滞在時間は消える', () => {
    const tracker = new DwellTracker()
    tracker.start(0)
    tracker.move('ch1', 0)
    tracker.move('ch2', 3000)

    tracker.start(10000)
    const totals = tracker.move('ch1', 10000)

    expect([...totals.keys()]).toEqual([])
  })
})
