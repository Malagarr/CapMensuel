import Link from 'next/link'
import { Wallet } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'

/**
 * Cadre commun aux pages de connexion, d'inscription et de mot de passe.
 * Volontairement sobre : rien ne doit distraire d'une saisie de mot de passe.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Wallet className="size-4.5" />
          </span>
          Budget Foyer
        </Link>
        <ThemeToggle />
      </header>

      <main
        id="contenu-principal"
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12"
      >
        {children}
      </main>
    </div>
  )
}
