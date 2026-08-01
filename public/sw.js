/**
 * Service worker de Budget Foyer (§17).
 *
 * Portée volontairement réduite pour une application financière :
 *  - les pages HTML sont toujours demandées au réseau (jamais de données
 *    périmées affichées comme si elles étaient à jour) ; en cas d'échec
 *    (hors ligne), on retombe sur la page /offline mise en cache.
 *  - les ressources statiques immuables de Next.js (/_next/static/…, dont
 *    le nom de fichier change à chaque build) sont mises en cache
 *    définitivement : les rejouer depuis le cache est toujours sûr.
 *  - tout le reste (API, Server Actions, requêtes Supabase) n'est jamais
 *    intercepté : la requête suit son chemin normal, sans passer par le SW.
 */

const CACHE_VERSION = 'v1'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navigation (chargement de page) : réseau d'abord, secours hors ligne sinon.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error())),
    )
    return
  }

  // Fichiers statiques Next.js versionnés dans leur nom : sûrs à mettre en
  // cache indéfiniment (« cache first »).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
