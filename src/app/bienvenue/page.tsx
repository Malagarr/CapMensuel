import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Wallet } from 'lucide-react'

import { Onboarding } from '@/app/bienvenue/onboarding'
import { SignOutButton } from '@/components/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { Card, CardBody } from '@/components/ui/card'
import { getActiveHousehold } from '@/lib/household'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Bienvenue' }

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  // Un utilisateur qui a déjà un foyer n'a rien à faire sur cette page.
  const active = await getActiveHousehold(user)
  if (active) redirect('/tableau-de-bord')

  const { data: profile } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', user.id)
    .maybeSingle()

  const params = await searchParams

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 font-semibold">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Wallet className="size-4.5" />
          </span>
          Budget Foyer
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main
        id="contenu-principal"
        className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 pb-12"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Bienvenue{profile?.first_name ? `, ${profile.first_name}` : ''}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Un foyer regroupe les comptes, les opérations et les budgets partagés. Créez
            le vôtre, ou rejoignez celui de quelqu’un avec un code d’invitation.
          </p>
        </div>

        <Card>
          <CardBody>
            <Onboarding defaultCode={params.code} />
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
