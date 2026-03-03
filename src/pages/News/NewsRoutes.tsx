import { Route, Routes, useLocation, type Location } from 'react-router-dom'
import { NewsPage } from './index'
import { NewsDetailsModal } from './NewsDetailsModal'
import { NewsDetailsPage } from './NewsDetailsPage'

type BackgroundLocationState = {
  backgroundLocation?: Location
}

export const NewsRoutes = () => {
  const location = useLocation()
  const state = location.state as BackgroundLocationState | null
  const backgroundLocation = state?.backgroundLocation

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route index element={<NewsPage />} />
        <Route path=":id" element={<NewsDetailsPage />} />
      </Routes>
      {backgroundLocation ? (
        <Routes>
          <Route path=":id" element={<NewsDetailsModal />} />
        </Routes>
      ) : null}
    </>
  )
}
