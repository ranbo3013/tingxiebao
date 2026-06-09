import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
    },
    {
      path: '/word-lists',
      name: 'wordLists',
      component: () => import('../views/WordLists.vue'),
    },
    {
      path: '/practice/:sessionId',
      name: 'practice',
      component: () => import('../views/Practice.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/History.vue'),
    },
    {
      path: '/result/:sessionId',
      name: 'result',
      component: () => import('../views/Result.vue'),
    },
  ],
})

export default router
