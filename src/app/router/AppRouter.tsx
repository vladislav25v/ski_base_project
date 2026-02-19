import { Navigate, Route, Routes } from 'react-router-dom'
import { AboutPage } from '../../pages/About'
import { GalleryPage } from '../../pages/Gallery'
import { HomePage } from '../../pages/Home'
import { LoginPage } from '../../pages/Login'
import { NewsPage } from '../../pages/News'
import { ProtocolsPage } from '../../pages/Protocols'
import { RentalPage } from '../../pages/Rental'
import { TracksSchemePage } from '../../pages/TracksScheme'
import { TrainingPage } from '../../pages/Training'
import { Layout } from '../../widgets/Layout'

export const AppRouter = () => {
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
