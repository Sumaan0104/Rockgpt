import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Self-host Outfit fonts (400, 500, 600) via @fontsource/outfit
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'

import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

import { isGoogleConfigured, rawGoogleClientId } from './config/googleAuth.js'
import { registerSW } from 'virtual:pwa-register'

// Instant Service Worker auto-update to ensure users never get stuck on stale versions
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true)
    },
    onRegistered(registration) {
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {})
        }, 15 * 60 * 1000)
      }
    },
  })

  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {isGoogleConfigured ? (
        <GoogleOAuthProvider clientId={rawGoogleClientId.trim()}>
          <App />
        </GoogleOAuthProvider>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
