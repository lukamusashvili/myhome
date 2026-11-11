import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import './styles/agent-os.css'
import { LocalizedApp } from './App.tsx'
import { AuthGate } from './components/AuthGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <LocalizedApp />
    </AuthGate>
  </StrictMode>,
)
