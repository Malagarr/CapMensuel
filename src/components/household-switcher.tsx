'use client'

import { useRef } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { switchHouseholdAction } from '@/lib/actions/household'
import type { HouseholdSummary } from '@/lib/household'

/**
 * Sélecteur de foyer.
 *
 * Rendu sous forme de <select> dans un <form> : le changement fonctionne même
 * sans JavaScript (le bouton de repli reste accessible), et avec JavaScript le
 * formulaire est envoyé dès la sélection.
 */
export function HouseholdSwitcher({
  households,
  activeId,
}: {
  households: HouseholdSummary[]
  activeId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  // Un seul foyer : afficher une liste déroulante n'aurait aucun sens.
  if (households.length <= 1) {
    const only = households[0]
    return (
      <span className="truncate text-sm font-semibold" title={only?.name}>
        {only?.name ?? 'Mon foyer'}
      </span>
    )
  }

  return (
    <form ref={formRef} action={switchHouseholdAction} className="relative">
      <label htmlFor="household-switcher" className="sr-only">
        Foyer actif
      </label>
      <select
        id="household-switcher"
        name="householdId"
        defaultValue={activeId}
        onChange={() => formRef.current?.requestSubmit()}
        className="appearance-none rounded-lg border border-transparent bg-transparent py-1.5 pl-2 pr-7 text-sm font-semibold hover:bg-muted focus:border-ring"
      >
        {households.map((household) => (
          <option key={household.id} value={household.id}>
            {household.name}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {/* Repli sans JavaScript : le bouton n'apparaît que si les scripts sont inactifs. */}
      <noscript>
        <button type="submit" className="ml-2 text-xs underline">
          Changer
          <Check className="inline size-3" aria-hidden="true" />
        </button>
      </noscript>
    </form>
  )
}
