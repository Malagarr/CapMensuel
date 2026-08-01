import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CalendarClock,
  LayoutDashboard,
  Landmark,
  ListChecks,
  Receipt,
  Tags,
  Upload,
  Users,
  Wallet,
} from 'lucide-react'

import { HouseholdSwitcher } from '@/components/household-switcher'
import { SignOutButton } from '@/components/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { requireActiveHousehold, listUserHouseholds } from '@/lib/household'
import { roleLabels } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * Gabarit des pages connectées.
 *
 * La navigation complète décrite au §23 — barre latérale sur ordinateur, barre
 * du bas sur mobile — sera introduite avec le tableau de bord (étape 13),
 * quand les pages qu'elle dessert existeront.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  // Redirige vers l'intégration si l'utilisateur n'a pas encore de foyer.
  const active = await requireActiveHousehold(user)
  const households = await listUserHouseholds(user.id)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
          <Link
            href="/tableau-de-bord"
            className="flex shrink-0 items-center gap-2"
            aria-label="Budget Foyer, accueil"
          >
            <span
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
              aria-hidden="true"
            >
              <Wallet className="size-4.5" />
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <HouseholdSwitcher households={households} activeId={active.household.id} />
            <Badge tone={active.role === 'viewer' ? 'neutral' : 'primary'}>
              {roleLabels[active.role]}
            </Badge>
          </div>

          <nav aria-label="Navigation principale" className="ml-auto flex items-center gap-1">
            <Link
              href="/tableau-de-bord"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Tableau de bord</span>
            </Link>
            <Link
              href="/operations"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Receipt className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Opérations</span>
            </Link>
            <Link
              href="/comptes"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Landmark className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Comptes</span>
            </Link>
            <Link
              href="/import"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Importer un relevé"
            >
              <Upload className="size-4" aria-hidden="true" />
              <span className="sr-only">Importer un relevé</span>
            </Link>
            <Link
              href="/recurrentes"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Opérations récurrentes"
            >
              <CalendarClock className="size-4" aria-hidden="true" />
              <span className="sr-only">Opérations récurrentes</span>
            </Link>
            <Link
              href="/categories"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Catégories"
            >
              <Tags className="size-4" aria-hidden="true" />
              <span className="sr-only">Catégories</span>
            </Link>
            <Link
              href="/regles"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Règles de catégorisation"
            >
              <ListChecks className="size-4" aria-hidden="true" />
              <span className="sr-only">Règles de catégorisation</span>
            </Link>
            <Link
              href="/foyer"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Users className="size-4" aria-hidden="true" />
              <span className="hidden lg:inline">Foyer</span>
            </Link>
            <ThemeToggle className="ml-1 hidden sm:inline-flex" />
            <SignOutButton label="" size="icon" />
          </nav>
        </div>
      </header>

      <main id="contenu-principal" className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        {children}
      </main>
    </div>
  )
}
