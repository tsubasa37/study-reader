import { createRouter, createWebHistory, type LocationQueryValue } from 'vue-router'

const single = (value: LocationQueryValue | LocationQueryValue[] | undefined): string | null =>
  typeof value === 'string' && value !== '' ? value : null

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'library', component: () => import('./pages/LibraryPage.vue') },
    {
      path: '/read',
      name: 'read',
      component: () => import('./pages/ReaderPage.vue'),
      props: (route) => ({
        path: single(route.query.path) ?? '',
        bookmarkId: single(route.query.bookmark),
        highlightId: single(route.query.highlight),
      }),
    },
    {
      path: '/project',
      name: 'project',
      component: () => import('./pages/ProjectPage.vue'),
      props: (route) => ({ folder: single(route.query.folder) ?? '' }),
    },
    { path: '/notes', name: 'notes', component: () => import('./pages/NotesPage.vue') },
  ],
})
