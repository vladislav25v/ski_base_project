import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './widgets/Layout'
import { HomePage } from './pages/Home'
import { NewsPage } from './pages/News'
import { TrainingPage } from './pages/Training'
import { LoginPage } from './pages/Login'
import { TracksSchemePage } from './pages/TracksScheme'
import { RentalPage } from './pages/Rental'
import { GalleryPage } from './pages/Gallery'
import { ProtocolsPage } from './pages/Protocols'
import { AboutPage } from './pages/About'

export const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="calendar" element={<Navigate to="/training" replace />} />
        <Route path="tracks-scheme" element={<TracksSchemePage />} />
        <Route path="rental" element={<RentalPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="protocols" element={<ProtocolsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="login" element={<Navigate to="/admin" replace />} />
        <Route path="admin" element={<LoginPage />} />
      </Route>
    </Routes>
  )
}
