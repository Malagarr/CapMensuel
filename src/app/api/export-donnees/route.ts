import { NextResponse } from 'next/server'

import { listUserHouseholds } from '@/lib/household'
import { createClient } from '@/lib/supabase/server'

/**
 * Export de toutes les données de l'utilisateur connecté (§18, droit à la
 * portabilité), au format JSON.
 *
 * Utilise le client Supabase authentifié de l'utilisateur, pas la clé
 * service_role : la Row Level Security garantit ainsi, sans logique
 * supplémentaire à maintenir ici, qu'on ne renvoie jamais que des données
 * appartenant à des foyers dont il est réellement membre.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, created_at')
    .eq('id', user.id)
    .maybeSingle()

  const households = await listUserHouseholds(user.id)

  const householdsData = await Promise.all(
    households.map(async (summary) => {
      const [{ data: household }, { data: categories }, { data: accounts }, { data: transactions }, { data: budgets }, { data: recurring }] =
        await Promise.all([
          supabase.from('households').select('*').eq('id', summary.id).maybeSingle(),
          supabase.from('categories').select('*').eq('household_id', summary.id),
          supabase.from('bank_accounts').select('*').eq('household_id', summary.id),
          supabase.from('transactions').select('*').eq('household_id', summary.id),
          supabase.from('category_budgets').select('*').eq('household_id', summary.id),
          supabase.from('recurring_transactions').select('*').eq('household_id', summary.id),
        ])

      return {
        household,
        monRole: summary.role,
        categories: categories ?? [],
        comptesBancaires: accounts ?? [],
        operations: transactions ?? [],
        budgets: budgets ?? [],
        operationsRecurrentes: recurring ?? [],
      }
    }),
  )

  const payload = {
    genereLe: new Date().toISOString(),
    profil: profile,
    foyers: householdsData,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="budget-foyer-export.json"',
      'Cache-Control': 'no-store',
    },
  })
}
