import type { Metadata } from 'next'

import { SignUpForm } from '@/app/(auth)/inscription/sign-up-form'
import { Card, CardBody } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Créer un compte' }

export default function SignUpPage() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Créer votre compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quelques informations et vous pourrez suivre votre budget.
        </p>
      </div>

      <Card>
        <CardBody>
          <SignUpForm />
        </CardBody>
      </Card>
    </>
  )
}
