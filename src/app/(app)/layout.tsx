import { redirect } from 'next/navigation'

import { AppBottomNav } from '@/components/app-bottom-nav'
import { AppSidebar } from '@/components/app-sidebar'
import { HouseholdSwitcher } from '@/components/household-switcher'
import { SignOutButton } from '@/components/sign-out-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { requireActiveHousehold, listUserHouseholds } from '@/lib/household'
import { roleLabels } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/**
 * Gabarit des pages connectées (§23).
 *
 * Barre latérale fixe sur ordinateur (AppSidebar), barre basse sur mobile et
 * tablette (AppBottomNav) — les deux partagent la même liste de pages
 * (src/lib/navigation.ts) pour ne jamais diverger.
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
    <div className="min-h-dvh lg:pl-60">
      <AppSidebar />

      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <HouseholdSwitcher households={households} activeId={active.household.id} />
            <Badge tone={active.role === 'viewer' ? 'neutral' : 'primary'}>
              {roleLabels[active.role]}
            </Badge>
          </div>

          {/* Sur ordinateur, le thème et la déconnexion vivent déjà dans la
              barre latérale : les répéter ici serait redondant. */}
          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <SignOutButton label="" size="icon" />
          </div>
        </div>
      </header>

      <main
        id="contenu-principal"
        className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 lg:px-6 lg:pb-6"
      >
        {children}
      </main>

      <AppBottomNav />
    </div>
  )
}
