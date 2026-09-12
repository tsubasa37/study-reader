import { describe, expect, it } from 'vitest'
import { decodeVaultPath } from '../../src/lib/frameInteractions'

describe('decodeVaultPath', () => {
  it('教材のリンク先 URL を資料フォルダ内のパスに戻す', () => {
    expect(decodeVaultPath(`/vault/sub/${encodeURIComponent('Ansible・CI基礎教科書.html')}`)).toBe(
      'sub/Ansible・CI基礎教科書.html',
    )
  })
})
