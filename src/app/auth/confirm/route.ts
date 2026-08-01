import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * Point d'arrivée des liens envoyés par e-mail :
 * confirmation d'inscription, réinitialisation de mot de passe, invitation.
 *
 * Supabase ajoute au lien un « token_hash » à usage unique, échangé ici contre
 * une session déposée dans les cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  // On n'accepte qu'un chemin interne : « next » vient de l'URL et pourrait
  // sinon rediriger vers un site tiers après authentification.
  const destination =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/tableau-de-bord'

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL('/connexion?erreur=lien_invalide', origin),
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    return NextResponse.redirect(new URL('/connexion?erreur=lien_expire', origin))
  }

  return NextResponse.redirect(new URL(destination, origin))
}
