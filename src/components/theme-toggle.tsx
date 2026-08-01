'use client'

import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme, type Theme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const options: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Automatique', icon: Monitor },
]

/** Sélecteur de thème sous forme de groupe de boutons radio accessible. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Apparence de l’application"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-border bg-card p-1',
        className,
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-lg transition-colors',
              selected
                ? 'bg-primary-soft text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
