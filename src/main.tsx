import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Import environment test for debugging (development only)
if (import.meta.env.DEV) {
  import('./utils/environmentTest').then(({ testEnvironmentDetection }) => {
    // Run environment detection test in development
    testEnvironmentDetection();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)