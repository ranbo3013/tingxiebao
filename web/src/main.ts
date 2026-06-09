import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'

// 预加载浏览器语音
window.speechSynthesis?.getVoices()
window.speechSynthesis?.addEventListener('voiceschanged', () => {
  window.speechSynthesis?.getVoices()
}, { once: true })

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
