import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import LoadErrorBoundary from './LoadErrorBoundary'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoadErrorBoundary><App /></LoadErrorBoundary>
  </StrictMode>,
)
