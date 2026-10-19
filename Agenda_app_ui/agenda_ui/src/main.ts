import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n, { applyLocale, savedLocale } from './i18n'

applyLocale(savedLocale())

createApp(App)
  .use(router)
  .use(i18n)
  .mount('#app')
