import { Routes, Route } from 'react-router-dom'
import { Layout } from './widgets/Layout'
import { HomePage } from './pages/Home'
import { NewsPage } from './pages/News'
import { CalendarPage } from './pages/Calendar'
import { AdminPage } from './pages/Admin'
import { LoginPage } from './pages/Login'

export const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}
