import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ImportWizard } from '@/app/(app)/import/import-wizard'
import { Alert } from '@/components/ui/alert'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Importer un relevé' }

export default async function ImportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)

  if (!canWrite(role)) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">Importer un relevé</h1>
        <Alert tone="info">
          Votre rôle est « lecture seule » : vous ne pouvez pas importer de relevé bancaire.
        </Alert>
      </div>
    )
  }

  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('id, name, currency')
    .eq('household_id', household.id)
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importer un relevé</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Déposez un fichier CSV ou Excel : il est analysé dans votre navigateur et n’est
          jamais envoyé sur nos serveurs. Vous validez chaque opération avant son
          enregistrement.
        </p>
      </div>

      {!accounts || accounts.length === 0 ? (
        <Alert tone="warning" title="Créez d’abord un compte">
          Un relevé s’importe toujours sur un compte bancaire existant.
        </Alert>
      ) : (
        <ImportWizard accounts={accounts} />
      )}
    </div>
  )
}
