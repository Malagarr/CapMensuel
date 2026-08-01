import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { RulesManager, type RuleAccountOption, type RuleCategoryOption, type RuleRow } from '@/app/(app)/regles/rules-manager'
import { Alert } from '@/components/ui/alert'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Règles de catégorisation' }

export default async function RulesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const writable = canWrite(role)

  // categorization_rules ne déclare pas de relation exploitable par le client
  // Supabase généré (Relationships: []) : les noms de catégorie et de compte
  // sont retrouvés via deux listes complètes, plutôt qu'une jointure imbriquée.
  const [{ data: rules }, { data: allCategories }, { data: allAccounts }] = await Promise.all([
    supabase
      .from('categorization_rules')
      .select(
        'id, rule_name, match_type, match_value, category_id, account_id, priority, is_active, hit_count',
      )
      .eq('household_id', household.id)
      .order('priority', { ascending: false })
      .order('rule_name', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, category_type, parent_category_id, is_active')
      .eq('household_id', household.id),
    supabase
      .from('bank_accounts')
      .select('id, name, is_active')
      .eq('household_id', household.id)
      .order('sort_order', { ascending: true }),
  ])

  const categoryNameById = new Map((allCategories ?? []).map((category) => [category.id, category.name]))
  const accountNameById = new Map((allAccounts ?? []).map((account) => [account.id, account.name]))

  const categoryOptions: RuleCategoryOption[] = (allCategories ?? [])
    .filter((category) => category.is_active)
    .map((category) => ({
      id: category.id,
      name: category.name,
      categoryType: category.category_type,
      parentName: category.parent_category_id ? categoryNameById.get(category.parent_category_id) ?? null : null,
    }))

  const accountOptions: RuleAccountOption[] = (allAccounts ?? [])
    .filter((account) => account.is_active)
    .map((account) => ({ id: account.id, name: account.name }))

  const rows: RuleRow[] = (rules ?? []).map((rule) => ({
    id: rule.id,
    ruleName: rule.rule_name,
    matchType: rule.match_type,
    matchValue: rule.match_value,
    categoryId: rule.category_id,
    categoryName: categoryNameById.get(rule.category_id) ?? 'Catégorie supprimée',
    accountId: rule.account_id,
    accountName: rule.account_id ? accountNameById.get(rule.account_id) ?? null : null,
    priority: rule.priority,
    isActive: rule.is_active,
    hitCount: rule.hit_count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Règles de catégorisation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une règle classe automatiquement toute opération future dont le libellé correspond,
          et prime toujours sur la détection automatique.
        </p>
      </div>

      {!writable && (
        <Alert tone="info">
          Votre rôle est « lecture seule » : vous pouvez consulter les règles, mais pas les
          modifier.
        </Alert>
      )}

      <RulesManager
        rules={rows}
        categories={categoryOptions}
        accounts={accountOptions}
        canWrite={writable}
      />
    </div>
  )
}
