import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
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
