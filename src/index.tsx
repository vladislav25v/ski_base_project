import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { AppRouter } from './app/router'
import './index.scss'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Корневой элемент не найден')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
)
