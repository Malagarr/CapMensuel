/**
 * Configuration Next.js.
 *
 * Les en-têtes de sécurité sont définis ici plutôt que dans le middleware :
 * ils s'appliquent ainsi également aux fichiers statiques.
 */

/**
 * Origine du projet Supabase, pour restreindre `connect-src` à ce seul hôte
 * plutôt qu'à tout *.supabase.co. Repli sur le joker si la variable n'est pas
 * encore disponible à ce stade (première installation, avant configuration).
 */
function supabaseOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
  } catch {
    return 'https://*.supabase.co'
  }
}

/**
 * Content-Security-Policy (§18).
 *
 * `script-src` et `style-src` gardent 'unsafe-inline' : l'application insère
 * un court script inline (choix du thème avant premier rendu, pour éviter le
 * flash blanc) sans infrastructure de nonce, et Tailwind ainsi que les styles
 * inline générés par React nécessitent 'unsafe-inline' sur style-src. Le
 * reste de la politique reste strict : aucune ressource tierce, aucun cadrage
 * par un site externe, connexions réseau limitées à Supabase.
 *
 * 'unsafe-eval' n'est ajouté qu'en développement : le serveur de
 * développement de Next.js évalue ses modules via eval() pour le rechargement
 * à chaud, ce qu'une CSP stricte bloque silencieusement (React ne plante pas,
 * mais aucun gestionnaire d'événement ne s'attache : l'application paraît
 * figée). Le build de production n'utilise jamais eval().
 */
function buildCsp() {
  const supabaseHttp = supabaseOrigin()
  const supabaseWs = supabaseHttp.replace('https://', 'wss://')
  const isDev = process.env.NODE_ENV !== 'production'

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHttp} ${supabaseWs}${isDev ? ' ws://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** En-têtes appliqués à toutes les réponses. */
const securityHeaders = [
  { key: 'Content-Security-Policy', value: buildCsp() },
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
