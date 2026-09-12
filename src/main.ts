import { createApp } from 'vue'
import App from './App.vue'
import { reportError } from './composables/useNotices'
import { router } from './router'
import './styles/tokens.css'
import './styles/base.css'
import './styles/notes.css'

const app = createApp(App)
app.config.errorHandler = (error) => reportError(error)
window.addEventListener('unhandledrejection', (event) => reportError(event.reason))
window.addEventListener('error', (event) => reportError(event.error ?? event.message))

app.use(router).mount('#app')
