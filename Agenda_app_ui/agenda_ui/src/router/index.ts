import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/AgendaDashboardView.vue'),
  },
  {
    path: '/eventlists',
    name: 'eventlist-list',
    component: () => import('../views/EventListsView.vue'),
  },
  {
    path: '/events',
    name: 'event-list',
    component: () => import('../views/EventsView.vue'),
  },
  {
    path: '/event-detail',
    name: 'event-detail',
    component: () => import('../views/EventDetailView.vue'),
  },
  {
    path: '/events/eventlist/:eventlist_id',
    name: 'event-by-eventlist',
    component: () => import('../views/EventsByEventlistView.vue'),
    props: true,
  },
  {
    path: '/events/priority',
    name: 'events-by-priority',
    component: () => import('../views/EventsByPriorityView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
