import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/AgendaDashboardView.vue'),
    },
    {
      path: '/events/:id(\\d+)',
      name: 'event-detail',
      component: () => import('../views/EventDetailView.vue'),
      props: (route) => ({ id: Number(route.params.id) }),
    },
  ],
})
