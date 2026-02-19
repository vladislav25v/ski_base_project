import { useEffect, useMemo, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { useAppSelector } from '../../../app/store/hooks'
import { selectTheme } from '../../../app/store/slices/uiSlice'
import { Button, LoaderFallbackDots } from '../../ui'
import { toLatLon, trackRoutes } from './model'
import styles from './TracksMap.module.scss'

const LOADER_ANIMATION_DEFAULT_PATH = '/loaders/default.json'
const LOADER_ANIMATION_YELLOW_PATH = '/loaders/yellow.json'

type YMapsApi = {
  ready: (handler: () => void) => void
  Map: new (element: HTMLElement, config: unknown, options?: unknown) => YMapsMap
  Polyline: new (coordinates: number[][], properties?: unknown, options?: unknown) => YMapsPolyline
}

type YMapsMap = {
  geoObjects: {
    add: (object: YMapsPolyline) => void
    remove: (object: YMapsPolyline) => void
  }
  setType: (type: string) => void
  setBounds: (bounds: number[][], options?: unknown) => void
  destroy: () => void
}

type YMapsPolyline = {
  geometry: {
    getBounds: () => number[][]
  }
}

declare global {
  interface Window {
    ymaps?: YMapsApi
  }
}

let ymapsPromise: Promise<YMapsApi> | null = null

const loadYMaps = (apiKey: string): Promise<YMapsApi> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Map is unavailable on server side'))
  }

  if (window.ymaps) {
    return Promise.resolve(window.ymaps)
  }

  if (ymapsPromise) {
    return ymapsPromise
  }

  ymapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async = true
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error('Yandex Maps API did not initialize'))
        return
      }

      window.ymaps.ready(() => resolve(window.ymaps as YMapsApi))
    }
    script.onerror = () => reject(new Error('Failed to load Yandex Maps API'))
    document.head.appendChild(script)
  })

  return ymapsPromise
}

const MAP_DEFAULT_CENTER: [number, number] = [55.1619, 124.7009]
const MAP_TYPE = 'yandex#satellite'
const DEFAULT_LINE_WIDTH = 4
const DEFAULT_LINE_OPACITY = 0.9

const getLineStyleFromCss = (element: HTMLElement | null) => {
  if (!element || typeof window === 'undefined') {
    return { width: DEFAULT_LINE_WIDTH, opacity: DEFAULT_LINE_OPACITY }
  }

  const styles = window.getComputedStyle(element)
  const widthValue = Number.parseFloat(styles.getPropertyValue('--track-line-width'))
  const opacityValue = Number.parseFloat(styles.getPropertyValue('--track-line-opacity'))

  const width = Number.isFinite(widthValue) ? widthValue : DEFAULT_LINE_WIDTH
  const opacity = Number.isFinite(opacityValue) ? opacityValue : DEFAULT_LINE_OPACITY

  return { width, opacity }
}

const DEFAULT_ROUTE_COLOR = '#f4ce14'

const getRouteColorFromCss = (element: HTMLElement | null, routeId: string) => {
  if (!element || typeof window === 'undefined') {
    return DEFAULT_ROUTE_COLOR
  }

  const cssRouteId = routeId.replace(/[^a-zA-Z0-9_-]/g, '-')
  const styles = window.getComputedStyle(element)
  const color = styles.getPropertyValue(`--track-color-${cssRouteId}`).trim()

  return color || DEFAULT_ROUTE_COLOR
}

export const TracksMap = () => {
  const apiKey = import.meta.env.VITE_YMAPS_API_KEY as string | undefined
  const theme = useAppSelector(selectTheme)
  const mapRef = useRef<HTMLDivElement | null>(null)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<YMapsMap | null>(null)
  const activeLineRef = useRef<YMapsPolyline | null>(null)
  const defaultRouteId = trackRoutes.find((route) => route.id === 'roller1200')?.id ?? trackRoutes[0].id
  const [selectedRouteId, setSelectedRouteId] = useState(defaultRouteId)
  const [mapError, setMapError] = useState('')
  const [isMapReady, setIsMapReady] = useState(false)

  const selectedRoute = useMemo(
    () => trackRoutes.find((route) => route.id === selectedRouteId) ?? trackRoutes[0],
    [selectedRouteId],
  )

  useEffect(() => {
    if (!apiKey) {
      setMapError('Не указан VITE_YMAPS_API_KEY в env.')
      return
    }

    if (!mapRef.current) {
      return
    }

    let disposed = false
    void loadYMaps(apiKey)
      .then((ymaps) => {
        if (disposed || !mapRef.current) {
          return
        }

        mapInstanceRef.current = new ymaps.Map(
          mapRef.current,
          {
            center: MAP_DEFAULT_CENTER,
            zoom: 14,
            type: MAP_TYPE,
            controls: ['zoomControl', 'fullscreenControl'],
          },
          {
            suppressMapOpenBlock: true,
          },
        )
        setIsMapReady(true)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Ошибка загрузки карты.'
        setMapError(message)
      })

    return () => {
      disposed = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }
      activeLineRef.current = null
      setIsMapReady(false)
    }
  }, [apiKey, theme])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) {
      return
    }
    map.setType(MAP_TYPE)
  }, [theme])

  useEffect(() => {
    if (isMapReady || mapError || !loaderRef.current) {
      return
    }

    const animation = lottie.loadAnimation({
      container: loaderRef.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: theme === 'dark' ? LOADER_ANIMATION_YELLOW_PATH : LOADER_ANIMATION_DEFAULT_PATH,
    })

    return () => {
      animation.destroy()
    }
  }, [isMapReady, mapError, theme])

  useEffect(() => {
    if (!isMapReady) {
      return
    }

    const map = mapInstanceRef.current
    if (!map) {
      return
    }

    if (activeLineRef.current) {
      map.geoObjects.remove(activeLineRef.current)
      activeLineRef.current = null
    }

    const coordinates = toLatLon(selectedRoute.coordinatesLonLat)
    if (coordinates.length < 2) {
      return
    }

    if (!window.ymaps) {
      return
    }
    const lineStyle = getLineStyleFromCss(mapRef.current)

    const lineColor = getRouteColorFromCss(mapRef.current, selectedRoute.id)

    const line = new window.ymaps.Polyline(
      coordinates,
      {
        hintContent: `Трасса ${selectedRoute.label}`,
      },
      {
        strokeColor: lineColor,
        strokeWidth: lineStyle.width,
        strokeOpacity: lineStyle.opacity,
      },
    )

    activeLineRef.current = line
    map.geoObjects.add(line)

    const bounds = line.geometry.getBounds()
    if (bounds) {
      map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 36 })
    }
  }, [isMapReady, selectedRoute])

  return (
    <section className={styles.section}>
      <div className={`${styles.controls} ${styles.animatedBlock} ${styles.controlsAnimated}`}>
        {trackRoutes.map((route) => {
          const isActive = route.id === selectedRoute.id
          return (
            <Button
              key={route.id}
              variant="outline"
              className={`${styles.routeButton} ${isActive ? styles.routeButtonActive : ''}`}
              onClick={() => setSelectedRouteId(route.id)}
            >
              {route.label}
            </Button>
          )
        })}
      </div>

      {mapError && <p className={`${styles.status} ${styles.statusError}`}>{mapError}</p>}
      {!mapError && selectedRoute.coordinatesLonLat.length < 2 && (
        <p className={`${styles.status} ${styles.statusMuted}`}>
          Для маршрута {selectedRoute.label} пока не добавлены точки.
        </p>
      )}

      <div className={`${styles.mapWrap} ${styles.animatedBlock} ${styles.mapAnimated}`}>
        {!isMapReady && !mapError && (
          <div className={styles.loader} role="status" aria-live="polite">
            <div className={styles.loaderAnimation} ref={loaderRef} />
            <p className={styles.loaderText}>
              {'Загрузка карты...'}
              {' '}
              <LoaderFallbackDots />
            </p>
          </div>
        )}
        <div ref={mapRef} className={styles.map} />
      </div>

      <div className={`${styles.description} ${styles.animatedBlock} ${styles.descriptionAnimated}`}>
        <p>
          Трасса имеет протяжённость 12,5 километров и ширину от 4 метров, что позволяет полноценно
          передвигаться как коньковым, так и классическим ходом.
        </p>
        <p>
          Стартовый круг 1200м имеет асфальтовое покрытие, предназначенное для катания на лыжероллерах и
          освещение, которое включается по средам во время вечерней тренировки.
        </p>
        <p>
          Трасса подготавливается снегоходами «Буран» и специализированными боронами дважды в неделю.
        </p>
      </div>
    </section>
  )
}


