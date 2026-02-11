import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './widgets/Layout'
import { HomePage } from './pages/Home'
import { NewsPage } from './pages/News'
import { CalendarPage } from './pages/Calendar'
import { LoginPage } from './pages/Login'

export const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="login" element={<Navigate to="/admin" replace />} />
        <Route path="admin" element={<LoginPage />} />
      </Route>
    </Routes>
  )
}
