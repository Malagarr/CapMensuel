import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Retour du flux d'autorisation par code (PKCE).
 *
 * Utilisé si un fournisseur d'identité externe est activé plus tard
 * (Google, Apple…). Le code à usage unique est échangé contre une session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  const destination =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/tableau-de-bord'

  if (!code) {
    return NextResponse.redirect(new URL('/connexion?erreur=lien_invalide', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/connexion?erreur=lien_expire', origin))
  }

  return NextResponse.redirect(new URL(destination, origin))
}
