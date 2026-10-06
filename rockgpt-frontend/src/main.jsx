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
