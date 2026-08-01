import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getEnv, isConfigured } from '@/lib/env'
import type { Database } from '@/types/database'

/** Page affichée tant que les clés Supabase ne sont pas renseignées. */
const SETUP_ROUTE = '/configuration-requise'

/** Routes accessibles sans être connecté. */
const PUBLIC_ROUTES = [
  '/',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
]

/** Préfixes techniques à ne jamais intercepter. */
const PUBLIC_PREFIXES = ['/auth/', '/api/public/']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Rafraîchit la session Supabase et protège les routes privées.
 *
 * Le rafraîchissement doit avoir lieu dans le middleware : c'est le seul
 * endroit où l'on peut à la fois lire les cookies de la requête et écrire les
 * cookies de la réponse.
 */
export async function updateSession(request: NextRequest) {
  // Premier lancement, avant que .env.local ne soit rempli : on n'essaie pas de
  // joindre Supabase et on explique la marche à suivre plutôt que d'échouer.
  if (!isConfigured()) {
    if (request.nextUrl.pathname === SETUP_ROUTE) {
      return NextResponse.next({ request })
    }
    const setupUrl = request.nextUrl.clone()
    setupUrl.pathname = SETUP_ROUTE
    setupUrl.search = ''
    return NextResponse.rewrite(setupUrl)
  }

  let response = NextResponse.next({ request })
  const env = getEnv()

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Les cookies mis à jour doivent être posés à la fois sur la requête
          // (pour la suite du traitement) et sur la réponse (pour le navigateur).
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Ne rien insérer entre createServerClient et getUser : tout code asynchrone
  // intercalé peut provoquer des déconnexions aléatoires difficiles à reproduire.
  //
  // Si Supabase est injoignable (coupure réseau, projet en pause), on considère
  // la session comme absente plutôt que de renvoyer une erreur 500 : l'accès est
  // refusé par défaut, ce qui est le comportement sûr.
  let user = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
  } catch {
    user = null
  }

  const { pathname } = request.nextUrl

  // Visiteur non connecté sur une page privée : redirection vers la connexion,
  // en mémorisant la page demandée pour y revenir après authentification.
  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/connexion'
    loginUrl.search = ''
    loginUrl.searchParams.set('suivant', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Utilisateur déjà connecté sur une page de connexion : on l'envoie chez lui.
  if (user && (pathname === '/connexion' || pathname === '/inscription')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/tableau-de-bord'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  return response
}
