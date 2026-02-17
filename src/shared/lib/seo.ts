type RouteSeoMeta = {
  title: string
  description: string
  robots?: string
}

const DEFAULT_SITE_URL = 'https://tyndaski.ru'

const getSiteUrl = () => {
  const rawSiteUrl = import.meta.env.VITE_SITE_URL as string | undefined
  const siteUrl = rawSiteUrl?.trim() || DEFAULT_SITE_URL
  return siteUrl.replace(/\/+$/, '')
}

const normalizePathname = (pathname: string) => {
  if (!pathname || pathname === '/') {
    return '/'
  }
  return pathname.replace(/\/+$/, '')
}

const ROUTE_META: Record<string, RouteSeoMeta> = {
  '/': {
    title: 'Лыжная база г. Тында',
    description:
      'Официальный сайт лыжной базы города Тында: новости, расписание тренировок, прокат лыж, галерея и контакты.',
  },
  '/news': {
    title: 'Новости | Лыжная база г. Тында',
    description: 'Актуальные новости лыжной базы города Тында, объявления и события.',
  },
  '/training': {
    title: 'График тренировок | Лыжная база г. Тында',
    description: 'График тренировок детей на лыжной базе города Тында.',
  },
  '/tracks-scheme': {
    title: 'Схема трасс | Лыжная база г. Тында',
    description: 'Схема лыжных трасс и ориентиры на территории лыжной базы.',
  },
  '/rental': {
    title: 'Прокат лыж | Лыжная база г. Тында',
    description: 'Режим работы проката лыж и полезная информация для посетителей.',
  },
  '/gallery': {
    title: 'Галерея | Лыжная база г. Тында',
    description: 'Фотографии с лыжной базы города Тында.',
  },
  '/protocols': {
    title: 'Протоколы | Лыжная база г. Тында',
    description: 'Протоколы соревнований и официальные результаты.',
  },
  '/about': {
    title: 'О базе | Лыжная база г. Тында',
    description: 'Информация о лыжной базе, контакты и как добраться.',
  },
  '/admin': {
    title: 'Вход в админку | Лыжная база г. Тында',
    description: 'Авторизация администратора.',
    robots: 'noindex, nofollow',
  },
}

const setMetaTag = (selector: string, attributes: Record<string, string>) => {
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    document.head.appendChild(tag)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    tag?.setAttribute(key, value)
  })
}

const setCanonical = (href: string) => {
  let canonical = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', href)
}

export const applyRouteSeo = (pathname: string) => {
  const normalizedPath = normalizePathname(pathname)
  const meta = ROUTE_META[normalizedPath] ?? ROUTE_META['/']
  const siteUrl = getSiteUrl()
  const canonicalUrl = normalizedPath === '/' ? siteUrl : `${siteUrl}${normalizedPath}`

  document.title = meta.title

  setMetaTag("meta[name='description']", {
    name: 'description',
    content: meta.description,
  })

  setMetaTag("meta[name='robots']", {
    name: 'robots',
    content: meta.robots ?? 'index, follow',
  })

  setMetaTag("meta[property='og:title']", {
    property: 'og:title',
    content: meta.title,
  })

  setMetaTag("meta[property='og:description']", {
    property: 'og:description',
    content: meta.description,
  })

  setMetaTag("meta[property='og:url']", {
    property: 'og:url',
    content: canonicalUrl,
  })

  setCanonical(canonicalUrl)
}
