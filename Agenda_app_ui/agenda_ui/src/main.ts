import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

const savedLocale = localStorage.getItem('locale') || 'en'
document.documentElement.setAttribute('dir', savedLocale === 'ar' ? 'rtl' : 'ltr')
document.documentElement.setAttribute('lang', savedLocale)

createApp(App)
  .use(router)
  .use(i18n)
  .mount('#app')