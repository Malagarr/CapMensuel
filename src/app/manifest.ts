import type { MetadataRoute } from 'next'

/**
 * Manifeste PWA (§17). Next.js le sert automatiquement sur
 * /manifest.webmanifest et l'y relie dans le <head>.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Budget Foyer',
    short_name: 'Budget Foyer',
    description:
      'Suivez vos revenus, vos dépenses et votre reste à vivre. Simple, clair, à plusieurs.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f7f9fa',
    theme_color: '#008589',
    lang: 'fr',
    dir: 'ltr',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
