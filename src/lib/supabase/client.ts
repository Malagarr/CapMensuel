'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * Client Supabase pour les composants React côté navigateur.
 *
 * createBrowserClient mémorise l'instance : appeler cette fonction plusieurs
 * fois ne crée pas plusieurs connexions temps réel.
 */
export function createClient() {
  const env = getEnv()
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}
