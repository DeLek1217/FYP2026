import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// index.css sets the baseline for your entire website
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
