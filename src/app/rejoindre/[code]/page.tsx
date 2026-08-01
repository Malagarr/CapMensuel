import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Ticket } from 'lucide-react'

import { AcceptInvitationForm } from '@/app/rejoindre/[code]/accept-form'
import { Card, CardBody } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Rejoindre un foyer' }

/**
 * Page d'arrivée d'un lien d'invitation.
 *
 * L'utilisateur doit être connecté : le middleware l'envoie sinon vers la page
 * de connexion, en mémorisant cette adresse pour l'y ramener ensuite.
 *
 * Le code n'est pas vérifié ici : la table des invitations n'est lisible que
 * par les administrateurs du foyer concerné. La validation a lieu dans la
 * fonction accept_household_invitation(), qui elle a les droits nécessaires.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { code } = await params
  const normalizedCode = decodeURIComponent(code).replace(/[\s-]/g, '').toUpperCase()

  if (!user) {
    redirect(`/connexion?suivant=${encodeURIComponent(`/rejoindre/${normalizedCode}`)}`)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Card>
        <CardBody>
          <span
            className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
            aria-hidden="true"
          >
            <Ticket className="size-6" />
          </span>

          <h1 className="text-xl font-bold tracking-tight">
            Invitation à rejoindre un foyer
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {profile?.first_name ? `${profile.first_name}, vous` : 'Vous'} êtes sur le point
            de rejoindre un budget partagé. Vous aurez accès à ses comptes, à ses
            opérations et à ses budgets.
          </p>

          <p className="mt-4 text-sm text-muted-foreground">Code d’invitation :</p>
          <code className="mt-1 block rounded-lg bg-muted px-3 py-2 font-mono tracking-widest">
            {normalizedCode}
          </code>

          <div className="mt-6">
            <AcceptInvitationForm code={normalizedCode} />
          </div>

          <p className="mt-4 text-center text-sm">
            <Link href="/tableau-de-bord" className="text-muted-foreground hover:underline">
              Ce n’est pas ce que je cherchais
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
