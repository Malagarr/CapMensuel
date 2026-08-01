import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccountsManager, type AccountRow, type MemberOption } from '@/app/(app)/comptes/accounts-manager'
import { Alert } from '@/components/ui/alert'
import { formatMoney } from '@/lib/format'
import { requireActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Comptes' }

export default async function AccountsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const writable = canWrite(role)

  const [{ data: accounts }, { data: balances }, { data: members }] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('*')
      .eq('household_id', household.id)
      .order('is_active', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    // Vue calculée : solde constaté et solde théorique.
    supabase
      .from('account_balances')
      .select('account_id, current_balance, projected_balance, cleared_count')
      .eq('household_id', household.id),
    supabase
      .from('household_members')
      .select('user_id, user:users(first_name, last_name, email)')
      .eq('household_id', household.id),
  ])

  const balanceByAccount = new Map(
    (balances ?? []).map((row) => [row.account_id, row]),
  )

  const rows: AccountRow[] = (accounts ?? []).map((account) => {
    const balance = balanceByAccount.get(account.id)
    return {
      id: account.id,
      name: account.name,
      bankName: account.bank_name,
      accountType: account.account_type,
      initialBalance: Number(account.initial_balance),
      currency: account.currency,
      color: account.color,
      icon: account.icon,
      ownerUserId: account.owner_user_id,
      isShared: account.is_shared,
      isActive: account.is_active,
      currentBalance: Number(balance?.current_balance ?? account.initial_balance),
      projectedBalance: Number(balance?.projected_balance ?? account.initial_balance),
      transactionCount: Number(balance?.cleared_count ?? 0),
    }
  })

  const memberOptions: MemberOption[] = (members ?? []).map((row) => ({
    userId: row.user_id,
    label:
      [row.user?.first_name, row.user?.last_name].filter(Boolean).join(' ') ||
      (row.user?.email ?? 'Membre'),
  }))

  // Le patrimoine total n'a de sens que sur les comptes actifs et dans une
  // devise unique : additionner des euros et des francs n'aurait aucun sens.
  const activeAccounts = rows.filter((row) => row.isActive)
  const singleCurrency = activeAccounts.every((row) => row.currency === household.currency)
  const total = activeAccounts.reduce((sum, row) => sum + row.currentBalance, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comptes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les comptes bancaires du foyer et leur solde calculé.
          </p>
        </div>

        {activeAccounts.length > 0 && singleCurrency && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total des comptes actifs</p>
            <p className="tabular text-2xl font-bold">
              {formatMoney(total, household.currency)}
            </p>
          </div>
        )}
      </div>

      {!writable && (
        <Alert tone="info">
          Votre rôle est « lecture seule » : vous pouvez consulter les comptes, mais pas
          les modifier.
        </Alert>
      )}

      <AccountsManager
        accounts={rows}
        members={memberOptions}
        householdCurrency={household.currency}
        canWrite={writable}
      />
    </div>
  )
}
