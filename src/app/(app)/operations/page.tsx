import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { OperationFilters, type FilterOptions } from '@/app/(app)/operations/filters'
import {
  OperationsView,
  type TransactionRow,
} from '@/app/(app)/operations/operations-view'
import type {
  AccountOption,
  CategoryOption,
  MemberOption,
} from '@/app/(app)/operations/transaction-form'
import { Alert } from '@/components/ui/alert'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { roundMoney } from '@/lib/utils'

export const metadata: Metadata = { title: 'Opérations' }

/** Nombre maximum de lignes affichées d'un coup. */
const PAGE_SIZE = 200

/** Premier et dernier jour d'un mois « 2026-08 ». */
function monthBounds(month: string): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null

  const year = Number(match[1])
  const monthNumber = Number(match[2])
  if (monthNumber < 1 || monthNumber > 12) return null

  const start = `${match[1]}-${match[2]}-01`
  // Le jour 0 du mois suivant est le dernier jour du mois demandé.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const end = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const writable = canWrite(role)
  const params = await searchParams

  const [{ data: accounts }, { data: categories }, { data: members }] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id, name, currency, is_active')
      .eq('household_id', household.id)
      .order('sort_order')
      .order('name'),
    supabase
      .from('categories')
      .select('id, name, category_type, color, icon, parent_category_id, is_active')
      .eq('household_id', household.id)
      .order('sort_order')
      .order('name'),
    supabase
      .from('household_members')
      .select('user_id, user:users(first_name, last_name, email)')
      .eq('household_id', household.id),
  ])

  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]))

  const memberOptions: MemberOption[] = (members ?? []).map((row) => ({
    userId: row.user_id,
    label:
      [row.user?.first_name, row.user?.last_name].filter(Boolean).join(' ') ||
      (row.user?.email ?? 'Membre'),
  }))
  const memberById = new Map(memberOptions.map((m) => [m.userId, m.label]))

  // Le formulaire ne propose que les comptes et catégories encore actifs :
  // saisir sur un compte archivé n'aurait pas de sens.
  const accountOptions: AccountOption[] = (accounts ?? [])
    .filter((account) => account.is_active)
    .map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
    }))

  const categoryOptions: CategoryOption[] = (categories ?? [])
    .filter((category) => category.is_active)
    .map((category) => ({
      id: category.id,
      name: category.name,
      categoryType: category.category_type,
      parentName: category.parent_category_id
        ? (categoryById.get(category.parent_category_id)?.name ?? null)
        : null,
    }))

  // ---------------------------------------------------------------------
  // Requête filtrée
  // ---------------------------------------------------------------------
  let query = supabase
    .from('transactions')
    // La liste des colonnes doit rester un littéral d'une seule pièce :
    // supabase-js l'analyse à la compilation pour typer le résultat, et une
    // concaténation lui ferait renvoyer un type d'erreur générique.
    .select(
      'id, transaction_date, label, normalized_label, amount, transaction_type, status, source, bank_account_id, category_id, member_user_id, user_id, notes, transfer_group_id',
    )
    .eq('household_id', household.id)

  const month = params.mois
  if (month) {
    const bounds = monthBounds(month)
    if (bounds) {
      query = query.gte('transaction_date', bounds.start).lte('transaction_date', bounds.end)
    }
  }

  if (params.compte) query = query.eq('bank_account_id', params.compte)

  if (params.categorie === 'aucune') {
    query = query.is('category_id', null)
  } else if (params.categorie) {
    query = query.eq('category_id', params.categorie)
  }

  if (params.membre) query = query.eq('member_user_id', params.membre)

  if (params.type === 'a_verifier') {
    query = query.eq('status', 'to_review')
  } else if (params.type === 'importee') {
    query = query.eq('source', 'import')
  } else if (
    params.type === 'expense' ||
    params.type === 'income' ||
    params.type === 'internal_transfer'
  ) {
    query = query.eq('transaction_type', params.type)
  }

  if (params.q) {
    // La recherche porte sur le libellé normalisé : elle ignore ainsi la
    // casse, les accents et le bruit technique du relevé bancaire.
    const term = params.q.trim().toLowerCase()
    if (term.length > 0) {
      query = query.or(`normalized_label.ilike.%${term}%,label.ilike.%${term}%`)
    }
  }

  const { data: transactions } = await query
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]))

  const rows: TransactionRow[] = (transactions ?? []).map((transaction) => {
    const category = transaction.category_id
      ? categoryById.get(transaction.category_id)
      : undefined
    const account = accountById.get(transaction.bank_account_id)

    return {
      id: transaction.id,
      transactionDate: transaction.transaction_date,
      label: transaction.label,
      amount: Number(transaction.amount),
      currency: account?.currency ?? household.currency,
      transactionType: transaction.transaction_type,
      status: transaction.status,
      bankAccountId: transaction.bank_account_id,
      categoryId: transaction.category_id,
      memberUserId: transaction.member_user_id,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      categoryIcon: category?.icon ?? null,
      accountName: account?.name ?? 'Compte supprimé',
      memberLabel: transaction.member_user_id
        ? (memberById.get(transaction.member_user_id) ?? null)
        : null,
      authorLabel: transaction.user_id ? (memberById.get(transaction.user_id) ?? null) : null,
      notes: transaction.notes,
      isImported: transaction.source === 'import',
      transferGroupId: transaction.transfer_group_id,
    }
  })

  // Les virements internes sont exclus des totaux : ce ne sont ni des
  // revenus ni des dépenses, seulement des déplacements d'argent.
  const realOperations = rows.filter((row) => row.transactionType !== 'internal_transfer')
  const totals = {
    income: roundMoney(
      realOperations.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0),
    ),
    expense: roundMoney(
      realOperations.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0),
    ),
    currency: household.currency,
  }

  // Mois disponibles, déduits des opérations existantes.
  const { data: allDates } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('household_id', household.id)
    .order('transaction_date', { ascending: false })
    .limit(2000)

  const monthSet = new Set<string>()
  for (const row of allDates ?? []) {
    monthSet.add(row.transaction_date.slice(0, 7))
  }
  monthSet.add(new Date().toISOString().slice(0, 7))

  const filterOptions: FilterOptions = {
    accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name })),
    categories: categoryOptions,
    members: memberOptions,
    months: [...monthSet].sort().reverse(),
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opérations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          L’historique du foyer. Chaque ligne indique sa catégorie, son compte et son état.
        </p>
      </div>

      {accountOptions.length === 0 ? (
        <Alert tone="warning" title="Créez d’abord un compte">
          Une opération doit être rattachée à un compte bancaire. Rendez-vous sur la page
          Comptes pour en ajouter un.
        </Alert>
      ) : (
        <>
          <OperationFilters options={filterOptions} />

          {rows.length === PAGE_SIZE && (
            <Alert tone="info">
              Seules les {PAGE_SIZE} opérations les plus récentes sont affichées. Affinez
              les filtres pour voir les plus anciennes.
            </Alert>
          )}

          <OperationsView
            transactions={rows}
            accounts={accountOptions}
            categories={categoryOptions}
            members={memberOptions}
            canWrite={writable}
            totals={totals}
          />
        </>
      )}
    </div>
  )
}
