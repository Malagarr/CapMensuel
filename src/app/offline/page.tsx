import { WifiOff } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button-styles'

/**
 * Page de secours du service worker (§17) : affichée quand l'utilisateur est
 * hors ligne et que la page demandée n'est pas déjà en cache. Volontairement
 * statique — aucune donnée financière n'est mise en cache hors ligne.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <WifiOff className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight">Vous êtes hors ligne</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cette page nécessite une connexion internet. Vérifiez votre réseau puis
          réessayez — vos données restent en sécurité sur nos serveurs.
        </p>
      </div>
      {/* Lien natif volontaire : un rechargement complet retente la requête
          réseau, alors qu'une navigation client Next échouerait pareillement. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className={buttonClasses({ className: 'mt-2' })}>
        Réessayer
      </a>
    </div>
  )
}
