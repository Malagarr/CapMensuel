import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ImportWizard, type ImportAccountOption, type ImportCategoryOption } from '@/app/(app)/import/import-wizard'
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
  const writable = canWrite(role)

  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id, name, bank_name, icon, color')
      .eq('household_id', household.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, category_type, parent_category_id, is_active')
      .eq('household_id', household.id)
      .eq('is_active', true),
  ])

  const categoryOptions: ImportCategoryOption[] = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    categoryType: category.category_type,
    parentName: category.parent_category_id
      ? (categories ?? []).find((c) => c.id === category.parent_category_id)?.name ?? null
      : null,
  }))

  const accountOptions: ImportAccountOption[] = (accounts ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    bankName: account.bank_name,
    icon: account.icon,
    color: account.color,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importer un relevé</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Déposez un export de votre banque (CSV ou Excel) : il est analysé entièrement
          dans votre navigateur, jamais envoyé à un serveur.
        </p>
      </div>

      {!writable && (
        <Alert tone="info">
          Votre rôle est « lecture seule » : vous ne pouvez pas importer de relevé.
        </Alert>
      )}

      {writable &&
        (accountOptions.length === 0 ? (
          <Alert tone="info">
            Créez d’abord un compte bancaire dans « Comptes » avant d’importer un relevé.
          </Alert>
        ) : (
          <ImportWizard accounts={accountOptions} categories={categoryOptions} />
        ))}
    </div>
  )
}
