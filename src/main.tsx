import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/cyrillic-400.css'
import '@fontsource/inter/cyrillic-500.css'
import '@fontsource/inter/cyrillic-600.css'
import './index.css'
import { initTelegram } from './telegram'
import { hydrateAdmin } from './store'
import App from './App.tsx'

initTelegram()

// правки админки лежат в IndexedDB, читаем их до первого показа, чтобы не мигали старые данные
hydrateAdmin().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
