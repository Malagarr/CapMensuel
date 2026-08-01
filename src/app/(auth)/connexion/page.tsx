import type { Metadata } from 'next'

import { SignInForm } from '@/app/(auth)/connexion/sign-in-form'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Connexion' }

/** Messages associés aux erreurs renvoyées par les liens reçus par e-mail. */
const linkErrors: Record<string, string> = {
  lien_invalide: 'Ce lien est incomplet. Demandez-en un nouveau.',
  lien_expire: 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.',
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ suivant?: string; erreur?: string }>
}) {
  const params = await searchParams

  // On ne réutilise « suivant » que s'il s'agit d'un chemin interne.
  const nextPath =
    params.suivant?.startsWith('/') && !params.suivant.startsWith('//')
      ? params.suivant
      : '/tableau-de-bord'

  const linkError = params.erreur ? linkErrors[params.erreur] : undefined

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Bon retour parmi nous</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connectez-vous pour retrouver le budget de votre foyer.
        </p>
      </div>

      {linkError && (
        <Alert tone="warning" className="mb-4">
          {linkError}
        </Alert>
      )}

      <Card>
        <CardBody>
          <SignInForm nextPath={nextPath} />
        </CardBody>
      </Card>
    </>
  )
}
