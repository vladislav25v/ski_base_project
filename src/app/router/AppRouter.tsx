import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '../../widgets/Layout'

const HomePage = lazy(() => import('../../pages/Home').then((module) => ({ default: module.HomePage })))
const NewsPage = lazy(() => import('../../pages/News').then((module) => ({ default: module.NewsPage })))
const TrainingPage = lazy(() =>
  import('../../pages/Training').then((module) => ({ default: module.TrainingPage })),
)
const TracksSchemePage = lazy(() =>
  import('../../pages/TracksScheme').then((module) => ({ default: module.TracksSchemePage })),
)
const RentalPage = lazy(() =>
  import('../../pages/Rental').then((module) => ({ default: module.RentalPage })),
)
const GalleryPage = lazy(() =>
  import('../../pages/Gallery').then((module) => ({ default: module.GalleryPage })),
)
const ProtocolsPage = lazy(() =>
  import('../../pages/Protocols').then((module) => ({ default: module.ProtocolsPage })),
)
const AboutPage = lazy(() =>
  import('../../pages/About').then((module) => ({ default: module.AboutPage })),
)
const LoginPage = lazy(() =>
  import('../../pages/Login').then((module) => ({ default: module.LoginPage })),
)

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
