'use client'

import { useRouter } from 'next/navigation'

import { capitalize, formatMonthLabel } from '@/lib/format'

/**
 * Sélecteur du mois affiché (§4 : « tableau de bord clair pour le mois
 * sélectionné »). L'état vit dans l'URL, pas en mémoire : la page reste
 * partageable et le calcul a lieu côté serveur.
 */
export function MonthPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter()

  const options: { value: string; label: string }[] = []
  const cursor = new Date(year, month - 1, 1)
  // Douze mois passés et deux mois à venir : assez pour naviguer sans excès.
  cursor.setMonth(cursor.getMonth() - 12)
  for (let i = 0; i < 15; i++) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth() + 1
    options.push({
      value: `${y}-${String(m).padStart(2, '0')}`,
      label: capitalize(formatMonthLabel(y, m)),
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const current = `${year}-${String(month).padStart(2, '0')}`

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">Mois affiché</span>
      <select
        value={current}
        onChange={(event) => router.push(`/tableau-de-bord?mois=${event.target.value}`)}
        className="h-10 rounded-xl border border-input bg-card px-3 font-medium focus:border-ring"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
