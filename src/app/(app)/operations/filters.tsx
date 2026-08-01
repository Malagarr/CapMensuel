'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef } from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { capitalize, formatMonthLabel } from '@/lib/format'
import type { CategoryOption } from '@/app/(app)/operations/transaction-form'

export type FilterOptions = {
  accounts: { id: string; name: string }[]
  categories: CategoryOption[]
  members: { userId: string; label: string }[]
  /** Mois disponibles, du plus récent au plus ancien : « 2026-08 ». */
  months: string[]
}

/**
 * Barre de filtres.
 *
 * L'état vit dans l'URL plutôt que dans un état React : la page reste
 * partageable et rechargeable, et le filtrage se fait côté serveur sur la
 * base — indispensable dès que l'historique dépasse quelques centaines de
 * lignes.
 */
export function OperationFilters({ options }: { options: FilterOptions }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function apply(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.replace(`/operations?${params.toString()}`, { scroll: false })
  }

  function onSearchChange(value: string) {
    // Sans temporisation, chaque frappe déclencherait une requête serveur.
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => apply('q', value), 350)
  }

  const hasFilters = ['q', 'compte', 'categorie', 'membre', 'type', 'mois'].some((key) =>
    searchParams.has(key),
  )

  return (
    <div className="space-y-3 rounded-app border border-border bg-card p-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="filter-search" className="sr-only">
          Rechercher dans les libellés
        </label>
        <input
          id="filter-search"
          type="search"
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher un libellé, un commerçant…"
          className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect
          label="Mois"
          value={searchParams.get('mois') ?? ''}
          onChange={(value) => apply('mois', value)}
          allLabel="Tous les mois"
          items={options.months.map((month) => {
            const [year, monthNumber] = month.split('-')
            return {
              value: month,
              label: capitalize(formatMonthLabel(Number(year), Number(monthNumber))),
            }
          })}
        />

        <FilterSelect
          label="Compte"
          value={searchParams.get('compte') ?? ''}
          onChange={(value) => apply('compte', value)}
          allLabel="Tous les comptes"
          items={options.accounts.map((account) => ({
            value: account.id,
            label: account.name,
          }))}
        />

        <FilterSelect
          label="Catégorie"
          value={searchParams.get('categorie') ?? ''}
          onChange={(value) => apply('categorie', value)}
          allLabel="Toutes les catégories"
          items={[
            { value: 'aucune', label: 'Sans catégorie' },
            ...options.categories.map((category) => ({
              value: category.id,
              label: category.parentName
                ? `${category.parentName} › ${category.name}`
                : category.name,
            })),
          ]}
        />

        <FilterSelect
          label="Membre"
          value={searchParams.get('membre') ?? ''}
          onChange={(value) => apply('membre', value)}
          allLabel="Tout le foyer"
          items={options.members.map((member) => ({
            value: member.userId,
            label: member.label,
          }))}
        />

        <FilterSelect
          label="Type"
          value={searchParams.get('type') ?? ''}
          onChange={(value) => apply('type', value)}
          allLabel="Tous les types"
          items={[
            { value: 'expense', label: 'Dépenses' },
            { value: 'income', label: 'Revenus' },
            { value: 'internal_transfer', label: 'Virements internes' },
            { value: 'a_verifier', label: 'À vérifier' },
            { value: 'importee', label: 'Importées' },
          ]}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.replace('/operations')}>
          <X className="size-3.5" aria-hidden="true" />
          Effacer les filtres
        </Button>
      )}
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  items,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allLabel: string
  items: { value: string; label: string }[]
}) {
  const id = `filter-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-input bg-card px-2.5 text-sm focus:border-ring"
      >
        <option value="">{allLabel}</option>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  )
}
