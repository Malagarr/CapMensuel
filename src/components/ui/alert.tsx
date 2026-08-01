import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const config: Record<
  Tone,
  { icon: typeof Info; box: string; iconColor: string; label: string }
> = {
  info: {
    icon: Info,
    box: 'bg-info-soft border-info/25',
    iconColor: 'text-info',
    label: 'Information',
  },
  success: {
    icon: CheckCircle2,
    box: 'bg-success-soft border-success/25',
    iconColor: 'text-success',
    label: 'Succès',
  },
  warning: {
    icon: AlertTriangle,
    box: 'bg-warning-soft border-warning/25',
    iconColor: 'text-warning',
    label: 'Attention',
  },
  danger: {
    icon: XCircle,
    box: 'bg-danger-soft border-danger/25',
    iconColor: 'text-danger',
    label: 'Erreur',
  },
}

/**
 * Message contextuel.
 * Les messages d'erreur utilisent role="alert" pour être annoncés immédiatement
 * par les lecteurs d'écran ; les autres utilisent role="status", moins intrusif.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  className?: string
}) {
  const { icon: Icon, box, iconColor, label } = config[tone]

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', box, className)}
    >
      <Icon className={cn('mt-0.5 size-4.5 shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {/* Le libellé du ton est repris en texte pour ne pas dépendre de la couleur. */}
        <span className="sr-only">{label} : </span>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  )
}
