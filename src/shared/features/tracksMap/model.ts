import { route10kmLonLat } from './routes/route10km'
import { route1200LonLat } from './routes/route1200'
import { route125kmLonLat } from './routes/route125km'
import { route3kmLonLat } from './routes/route3km'
import { route5kmLonLat } from './routes/route5km'
import { route75kmLonLat } from './routes/route75km'
import { route800LonLat } from './routes/route800'
import { routeRoller1200LonLat } from './routes/routeRoller1200'
import type { LatLon, LonLat } from './types'

export type TrackRoute = {
  id: string
  label: string
  coordinatesLonLat: LonLat[]
}

export const trackRoutes: TrackRoute[] = [
  { id: '1200m', label: 'нижняя 1200м', coordinatesLonLat: route1200LonLat },
  { id: '800m', label: '800м', coordinatesLonLat: route800LonLat },
  { id: '3km', label: '3км', coordinatesLonLat: route3kmLonLat },
  { id: '5km', label: '5км', coordinatesLonLat: route5kmLonLat },
  { id: '7.5km', label: '7,5км', coordinatesLonLat: route75kmLonLat },
  { id: '10km', label: '10км', coordinatesLonLat: route10kmLonLat },
  { id: '12.5km', label: '12,5км', coordinatesLonLat: route125kmLonLat },
  {
    id: 'roller1200',
    label: 'стартовая 1200м',
    coordinatesLonLat: routeRoller1200LonLat,
  },
]

export const toLatLon = (coordinatesLonLat: LonLat[]): LatLon[] =>
  coordinatesLonLat.map(([lon, lat]) => [lat, lon])
