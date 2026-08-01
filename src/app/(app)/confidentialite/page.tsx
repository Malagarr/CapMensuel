import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Download, ShieldCheck } from 'lucide-react'

import { DeleteAccountForm } from '@/app/(app)/confidentialite/delete-account-form'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Confidentialité' }

export default async function PrivacyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Confidentialité et données</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos droits sur les données que Budget Foyer conserve à votre sujet.
        </p>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              Ce que nous conservons
            </span>
          }
          description="Le strict nécessaire au fonctionnement de l’application."
        />
        <CardBody className="space-y-2 pt-2 text-sm text-muted-foreground">
          <p>
            Votre profil (nom, e-mail), les foyers dont vous êtes membre, les comptes
            bancaires, opérations, budgets et catégories que vous ou les autres membres
            y avez saisis. Les relevés bancaires que vous importez sont analysés
            directement dans votre navigateur : le fichier lui-même n’est jamais envoyé
            à nos serveurs, seules les opérations que vous validez le sont.
          </p>
          <p>
            Ces données sont protégées par un cloisonnement strict entre foyers
            (Row Level Security) : personne en dehors de votre foyer ne peut y accéder,
            pas même un autre foyer hébergé sur la même base.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Download className="size-4 text-primary" aria-hidden="true" />
              Exporter mes données
            </span>
          }
          description="Téléchargez une copie complète, au format JSON, de tout ce qui vous concerne."
        />
        <CardBody className="pt-2">
          <a href="/api/export-donnees" className={buttonClasses({ variant: 'outline' })}>
            <Download className="size-4" aria-hidden="true" />
            Télécharger mes données
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Supprimer mon compte"
          description="Efface définitivement votre profil et, le cas échéant, les foyers que vous seul possédez."
        />
        <CardBody className="pt-2">
          <DeleteAccountForm />
        </CardBody>
      </Card>
    </div>
  )
}
