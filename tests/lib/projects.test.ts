import { describe, expect, it } from 'vitest'
import { groupIntoProjects, projectFolderOf } from '../../src/lib/projects'
import type { Bookmark, DocumentEntry, DocumentProgress, Highlight } from '../../shared/types'

const document = (path: string): DocumentEntry => ({
  path,
  name: path.slice(path.lastIndexOf('/') + 1).replace(/\.html$/, ''),
  folder: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
  kind: 'html',
  size: 100,
  modifiedAt: '2026-09-11T00:00:00.000Z',
})

const progress = (path: string, overrides: Partial<DocumentProgress> = {}): DocumentProgress => ({
  path,
  lastOpenedAt: '2026-09-11T04:00:00.000Z',
  position: { sectionId: 'ch1', sectionOffset: 0, scrollRatio: 0 },
  sectionTitle: '第1章',
  readSectionIds: ['ch1'],
  sectionCount: 10,
  ...overrides,
})

const documents = [
  document('インフラ/Ansible.html'),
  document('インフラ/深い階層/Linux.html'),
  document('フロント/Vue3.html'),
  document('Laravel土台.html'),
]

describe('projectFolderOf', () => {
  it.each([
    ['インフラ/Ansible.html', 'インフラ'],
    ['インフラ/深い階層/Linux.html', 'インフラ'],
    ['Laravel土台.html', ''],
  ])('%s のプロジェクトは %s', (path, expected) => {
    expect(projectFolderOf(path)).toBe(expected)
  })
})

describe('groupIntoProjects', () => {
  it('直下のフォルダごとにまとめ、入れ子の資料も同じプロジェクトに入れる', () => {
    const shelf = groupIntoProjects(documents, {}, [], [])

    expect(shelf.projects.map((project) => [project.folder, project.documents.length])).toEqual([
      ['インフラ', 2],
      ['フロント', 1],
    ])
    expect(shelf.loose.map((entry) => entry.path)).toEqual(['Laravel土台.html'])
  })

  it('フォルダが無ければプロジェクトは作らない', () => {
    const shelf = groupIntoProjects([document('Laravel土台.html')], {}, [], [])

    expect(shelf.projects).toEqual([])
    expect(shelf.loose).toHaveLength(1)
  })

  it('章の進み具合・しおり・ハイライトをプロジェクト単位で合計する', () => {
    const bookmarks = [{ path: 'インフラ/Ansible.html' } as Bookmark, { path: 'フロント/Vue3.html' } as Bookmark]
    const highlights = [{ path: 'インフラ/深い階層/Linux.html' } as Highlight]

    const [infra] = groupIntoProjects(
      documents,
      {
        'インフラ/Ansible.html': progress('インフラ/Ansible.html', { readSectionIds: ['a', 'b'], sectionCount: 10 }),
        'インフラ/深い階層/Linux.html': progress('インフラ/深い階層/Linux.html', {
          readSectionIds: ['a'],
          sectionCount: 5,
        }),
      },
      bookmarks,
      highlights,
    ).projects

    expect(infra).toMatchObject({
      openedDocuments: 2,
      readSections: 3,
      totalSections: 15,
      bookmarks: 1,
      highlights: 1,
    })
  })

  it('最後に開いた資料をプロジェクトの「続き」として返す', () => {
    const [infra] = groupIntoProjects(
      documents,
      {
        'インフラ/Ansible.html': progress('インフラ/Ansible.html', { lastOpenedAt: '2026-09-10T00:00:00.000Z' }),
        'インフラ/深い階層/Linux.html': progress('インフラ/深い階層/Linux.html', {
          lastOpenedAt: '2026-09-11T09:00:00.000Z',
          sectionTitle: '03 ネットワーク',
        }),
      },
      [],
      [],
    ).projects

    expect(infra?.lastDocument).toEqual({
      path: 'インフラ/深い階層/Linux.html',
      name: 'Linux',
      sectionTitle: '03 ネットワーク',
    })
    expect(infra?.lastOpenedAt).toBe('2026-09-11T09:00:00.000Z')
  })

  it('一度も開いていないプロジェクトは合計が 0 で、最後に開いた資料も無い', () => {
    const [, front] = groupIntoProjects(documents, {}, [], []).projects

    expect(front).toMatchObject({ openedDocuments: 0, totalSections: 0, lastOpenedAt: null, lastDocument: null })
  })
})

