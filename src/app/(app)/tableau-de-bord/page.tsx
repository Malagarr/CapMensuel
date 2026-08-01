import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Users } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button-styles'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { currencySymbol } from '@/lib/format'
import { requireActiveHousehold } from '@/lib/household'
import { roleDescriptions, roleLabels } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Tableau de bord' }

/**
 * Tableau de bord — version provisoire.
 *
 * Les indicateurs financiers (reste à vivre, prévisions, jauges) seront
 * ajoutés à l'étape 13, une fois les comptes et les opérations en place.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role, isOwner } = await requireActiveHousehold(user)

  // Aperçu de ce qui a déjà été installé dans le foyer.
  const [{ count: categoryCount }, { count: accountCount }, { count: memberCount }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', household.id)
        .eq('is_active', true),
      supabase
        .from('bank_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', household.id),
      supabase
        .from('household_members')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', household.id),
    ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{household.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {roleLabels[role]}
          {isOwner && ' · créateur du foyer'} · devise {currencySymbol(household.currency)}
        </p>
      </div>

      <Alert tone="info" title="Étape 4 sur 20 : le foyer est en place">
        Les prochaines étapes ajouteront les comptes bancaires, les catégories
        personnalisées, la saisie des opérations, puis les indicateurs financiers de
        cette page : reste à vivre, budget quotidien et prévision de fin de mois.
      </Alert>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Membres du foyer</p>
            <p className="mt-1 text-2xl font-bold tabular">{memberCount ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Catégories actives</p>
            <p className="mt-1 text-2xl font-bold tabular">{categoryCount ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-muted-foreground">Comptes bancaires</p>
            <p className="mt-1 text-2xl font-bold tabular">{accountCount ?? 0}</p>
            <Link
              href="/comptes"
              className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
            >
              {(accountCount ?? 0) === 0 ? 'Ajouter un compte' : 'Gérer les comptes'}
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Vos droits dans ce foyer"
          description={roleDescriptions[role]}
          action={
            <Link href="/foyer" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
              <Users className="size-4" aria-hidden="true" />
              Gérer
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        />
        <CardBody className="pt-3 text-sm text-muted-foreground">
          Invitez votre conjoint, votre famille ou vos colocataires depuis la page Foyer.
          Chacun verra le budget partagé, et chaque opération indiquera qui l’a saisie.
        </CardBody>
      </Card>
    </div>
  )
}
