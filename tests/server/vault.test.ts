import { afterEach, describe, expect, it } from 'vitest'
import { HttpError } from '../../server/errors'
import { resolveVaultPath, scanDocuments } from '../../server/vault'
import { createTempVault, type TempVault } from './helpers'

let vault: TempVault | undefined

afterEach(async () => {
  await vault?.cleanup()
  vault = undefined
})

describe('scanDocuments', () => {
  it('HTML だけを、隠しフォルダと隠しファイルを除いてパス順に返す', async () => {
    vault = await createTempVault({
      'Vue3基礎教科書.html': '<p>vue</p>',
      'infra/Ansible.htm': '<p>ansible</p>',
      'TypeScript基礎教科書.pdf': 'pdf',
      '.study/progress.json': '{}',
      '.hidden.html': '<p>hidden</p>',
    })

    const documents = await scanDocuments(vault.dir)

    expect(documents.map((document) => [document.path, document.name, document.folder])).toEqual([
      ['infra/Ansible.htm', 'Ansible', 'infra'],
      ['Vue3基礎教科書.html', 'Vue3基礎教科書', ''],
    ])
    expect(documents[1]?.size).toBe('<p>vue</p>'.length)
  })
})

describe('resolveVaultPath', () => {
  it.each(['../secret.html', 'a/../../b.html', '.study/progress.json', 'sub/.hidden.html', '', 'a//b.html', 'a\\b.html'])(
    '%s は開けない',
    (path) => {
      expect(() => resolveVaultPath('/vault', path)).toThrow(HttpError)
    },
  )

  it('入れ子の資料を絶対パスにする', () => {
    expect(resolveVaultPath('/vault', 'infra/Ansible・CI基礎教科書.html')).toBe('/vault/infra/Ansible・CI基礎教科書.html')
  })
})
