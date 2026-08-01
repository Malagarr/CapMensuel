'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { MoreHorizontal, Plus, X } from 'lucide-react'

import { mobileMoreItems, mobilePrimaryItems } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/**
 * Barre de navigation basse (§23, mobile).
 *
 * Ordre imposé par le cahier des charges : Accueil, Opérations, Ajouter,
 * Importer, Budget, Plus. « Ajouter » n'est pas une page mais un raccourci
 * vers la saisie rapide d'opération, mis en avant au centre.
 */
export function AppBottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const [home, operations, imports, budgets] = mobilePrimaryItems
  if (!home || !operations || !imports || !budgets) return null

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {moreOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMoreOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
        />
      )}

      {moreOpen && (
        <div
          role="menu"
          aria-label="Plus de pages"
          className="fixed inset-x-3 bottom-[4.75rem] z-50 rounded-app border border-border bg-card p-2 shadow-lg lg:hidden"
        >
          {mobileMoreItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                  isActive(item.href)
                    ? 'bg-primary-soft text-primary'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid grid-cols-6 items-end px-1 pb-1.5 pt-1.5">
          <BottomLink item={home} active={isActive(home.href)} />
          <BottomLink item={operations} active={isActive(operations.href)} />

          <Link
            href="/operations?nouveau=1"
            className="col-span-1 flex flex-col items-center justify-center gap-1"
            aria-label="Ajouter une opération"
          >
            <span className="-mt-6 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <Plus className="size-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">Ajouter</span>
          </Link>

          <BottomLink item={imports} active={isActive(imports.href)} />
          <BottomLink item={budgets} active={isActive(budgets.href)} />

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className="flex flex-col items-center gap-1 py-1 text-muted-foreground"
          >
            {moreOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="size-5" aria-hidden="true" />
            )}
            <span className="text-[11px] font-medium">Plus</span>
          </button>
        </div>
      </nav>
    </>
  )
}

function BottomLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: (typeof mobilePrimaryItems)[number]['icon'] }
  active: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-1 py-1 text-[11px] font-medium',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      {item.label === 'Tableau de bord' ? 'Accueil' : item.label}
    </Link>
  )
}
