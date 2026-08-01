'use client'

import { useEffect } from 'react'

/**
 * Enregistre le service worker (§17). Uniquement en production : en
 * développement, le SW mettrait en cache des chunks que Next régénère à
 * chaque changement, cassant le rechargement à chaud.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Un échec d'enregistrement ne doit jamais empêcher l'application de
      // fonctionner : la PWA reste utilisable, simplement sans mode hors ligne.
    })
  }, [])

  return null
}
