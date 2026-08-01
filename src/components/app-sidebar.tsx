'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { SignOutButton } from '@/components/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { brandIcon as BrandIcon, navItems } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/**
 * Barre latérale fixe (§23, ordinateur).
 *
 * Cachée en dessous du seuil `lg` : sur mobile et tablette, c'est la barre du
 * bas (AppBottomNav) qui porte la navigation.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <Link
        href="/tableau-de-bord"
        className="flex items-center gap-2 px-5 py-5 font-semibold"
      >
        <span
          className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <BrandIcon className="size-4.5" />
        </span>
        Budget Foyer
      </Link>

      <nav aria-label="Navigation principale" className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex items-center justify-between gap-2 border-t border-border p-3">
        <ThemeToggle />
        <SignOutButton size="sm" />
      </div>
    </aside>
  )
}
