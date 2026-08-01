import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/app/(auth)/mot-de-passe-oublie/forgot-password-form'
import { Card, CardBody } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indiquez votre adresse e-mail : nous vous enverrons un lien pour en choisir un
          nouveau.
        </p>
      </div>

      <Card>
        <CardBody>
          <ForgotPasswordForm />
        </CardBody>
      </Card>
    </>
  )
}
