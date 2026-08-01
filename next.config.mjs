/**
 * Configuration Next.js.
 *
 * Les en-têtes de sécurité sont définis ici plutôt que dans le middleware :
 * ils s'appliquent ainsi également aux fichiers statiques.
 */

/** En-têtes appliqués à toutes les réponses. */
const securityHeaders = [
  // Empêche le navigateur de « deviner » un type MIME différent de celui annoncé.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Interdit l'affichage de l'application dans une iframe tierce (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  // Ne transmet l'URL complète qu'aux pages de la même origine.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Désactive les API navigateur dont l'application n'a pas besoin.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Force HTTPS pendant 2 ans (n'a d'effet qu'en HTTPS, donc sans risque en local).
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Les erreurs TypeScript et ESLint doivent bloquer le build : sur une application
  // qui manipule des données bancaires, on ne déploie pas du code qui ne compile pas.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  // Masque la version de Next dans les en-têtes de réponse.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Le service worker ne doit jamais être servi depuis le cache HTTP,
        // sinon les mises à jour de l'application ne sont jamais prises en compte.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
