import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { getEnv, getServiceRoleKey } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Client Supabase avec la clé « service_role », qui contourne la Row Level
 * Security (§18).
 *
 * Réservé aux opérations qu'aucun utilisateur ne peut faire sur ses propres
 * données via RLS : ici, la suppression du compte d'authentification lui-même
 * (auth.admin.deleteUser), qu'aucune politique RLS ne peut jamais autoriser
 * puisque la table auth.users n'y est pas soumise.
 *
 * Ne jamais réutiliser ce client pour lire ou écrire des données métier : ce
 * serait contourner sans raison les politiques RLS qui protègent l'isolation
 * entre foyers.
 */
export function createAdminClient() {
  const env = getEnv()

  return createSupabaseClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
