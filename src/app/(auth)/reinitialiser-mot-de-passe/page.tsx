import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ResetPasswordForm } from '@/app/(auth)/reinitialiser-mot-de-passe/reset-password-form'
import { Card, CardBody } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

export default async function ResetPasswordPage() {
  // On n'arrive ici qu'avec la session ouverte par le lien reçu par e-mail.
  // Sans elle, la page n'a pas lieu d'être affichée.
  const user = await getCurrentUser()
  if (!user) {
    redirect('/mot-de-passe-oublie?erreur=lien_expire')
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Choisir un nouveau mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Il remplacera immédiatement l’ancien sur tous vos appareils.
        </p>
      </div>

      <Card>
        <CardBody>
          <ResetPasswordForm />
        </CardBody>
      </Card>
    </>
  )
}
