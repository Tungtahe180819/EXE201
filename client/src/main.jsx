import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import './pages/styles/Eventverse.css';
import App from './pages/App.jsx'

// Local để trống và dùng proxy Vite; production trỏ tới backend đã deploy.
axios.defaults.baseURL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
