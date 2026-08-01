import { AlertTriangle, Check, TrendingUp } from 'lucide-react'

import { formatPercent } from '@/lib/format'
import { clamp, cn } from '@/lib/utils'

export type BudgetStatus = 'ok' | 'warning' | 'exceeded'

/**
 * Détermine l'état d'un budget à partir du taux d'utilisation.
 * Seuils demandés : vert < 80 %, orange >= 80 %, rouge > 100 %.
 */
export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return 'exceeded'
  if (ratio >= 0.8) return 'warning'
  return 'ok'
}

const statusConfig: Record<
  BudgetStatus,
  { bar: string; text: string; icon: typeof Check; label: string }
> = {
  ok: {
    bar: 'bg-success',
    text: 'text-success',
    icon: Check,
    label: 'Budget maîtrisé',
  },
  warning: {
    bar: 'bg-warning',
    text: 'text-warning',
    icon: TrendingUp,
    label: 'Budget bientôt atteint',
  },
  exceeded: {
    bar: 'bg-danger',
    text: 'text-danger',
    icon: AlertTriangle,
    label: 'Budget dépassé',
  },
}

/**
 * Jauge de progression accessible.
 *
 * L'information est portée par trois canaux indépendants — texte, icône et
 * couleur — afin de rester compréhensible en cas de daltonisme ou d'impression
 * en noir et blanc.
 */
export function Gauge({
  value,
  max,
  label,
  showStatusLabel = true,
  className,
}: {
  /** Montant consommé. */
  value: number
  /** Montant maximum prévu. */
  max: number
  /** Nom de ce que mesure la jauge, lu par les lecteurs d'écran. */
  label: string
  showStatusLabel?: boolean
  className?: string
}) {
  // Un budget à 0 est considéré comme dépassé dès le premier euro dépensé.
  const ratio = max > 0 ? value / max : value > 0 ? Infinity : 0
  const status = budgetStatus(ratio)
  const { bar, text, icon: Icon, label: statusLabel } = statusConfig[status]

  // La barre est plafonnée à 100 % ; le dépassement est indiqué par le texte.
  const width = Number.isFinite(ratio) ? clamp(ratio, 0, 1) * 100 : 100
  const percentLabel = Number.isFinite(ratio) ? formatPercent(ratio) : '—'

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(Number.isFinite(ratio) ? ratio * 100 : 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} : ${percentLabel} utilisé. ${statusLabel}.`}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', bar)}
          style={{ width: `${width}%` }}
        />
      </div>

      {showStatusLabel && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn('inline-flex items-center gap-1 font-medium', text)}>
            <Icon className="size-3.5" aria-hidden="true" />
            {statusLabel}
          </span>
          <span className="tabular text-muted-foreground">{percentLabel}</span>
        </div>
      )}
    </div>
  )
}
