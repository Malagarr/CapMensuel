import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

import { getEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Client Supabase pour les Server Components, Server Actions et Route Handlers.
 *
 * La session est portée par des cookies. Chaque requête doit créer son propre
 * client : ne jamais mettre le résultat en variable globale, sinon la session
 * d'un utilisateur pourrait être servie à un autre.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const env = getEnv()

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Un Server Component ne peut pas écrire de cookie. Ce cas est
            // normal : le rafraîchissement de session est assuré par le
            // middleware, qui lui en a le droit.
          }
        },
      },
    },
  )
}

/**
 * Renvoie l'utilisateur connecté, ou null.
 *
 * On utilise getUser() et non getSession() : getUser() valide le jeton auprès
 * du serveur Supabase, alors que getSession() se contente de lire le cookie,
 * qui pourrait avoir été forgé.
 */
export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}
