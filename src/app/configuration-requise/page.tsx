import type { Metadata } from 'next'
import { KeyRound } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Card, CardBody, CardHeader } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Configuration requise' }

/**
 * Page de premier lancement.
 *
 * Le middleware réécrit toutes les requêtes vers cette page tant que les clés
 * Supabase sont absentes : l'utilisateur voit une consigne claire plutôt qu'une
 * erreur 500 incompréhensible.
 */
export default function SetupRequiredPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning"
          aria-hidden="true"
        >
          <KeyRound className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Configuration requise</h1>
          <p className="text-sm text-muted-foreground">
            L’application n’est pas encore reliée à votre base de données.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Trois étapes"
          description="Comptez cinq minutes, aucune carte bancaire n’est demandée."
        />
        <CardBody className="space-y-5 pt-3 text-sm">
          <ol className="space-y-5">
            <li>
              <p className="font-medium">1. Créez un projet Supabase</p>
              <p className="mt-1 text-muted-foreground">
                Rendez-vous sur supabase.com, créez un projet gratuit et choisissez une
                région proche de vous (par exemple « Europe West »).
              </p>
            </li>

            <li>
              <p className="font-medium">2. Copiez vos clés</p>
              <p className="mt-1 text-muted-foreground">
                Dans le tableau de bord Supabase, cliquez sur l’engrenage{' '}
                <em>Project Settings</em> puis <em>API Keys</em>. Créez un fichier{' '}
                <code className="font-mono">.env.local</code> à la racine du projet, sur le
                modèle de <code className="font-mono">.env.example</code> :
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                {`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000`}
              </pre>
              <p className="mt-2 text-muted-foreground">
                Selon l’âge de votre projet, Supabase affiche soit{' '}
                <em>Publishable key</em> et <em>Secret keys</em> (format{' '}
                <code className="font-mono">sb_…</code>), soit <em>anon</em> et{' '}
                <em>service_role</em> (longues chaînes{' '}
                <code className="font-mono">eyJhbGciOi…</code>). Les deux
                fonctionnent : prenez celles que vous voyez.
              </p>
            </li>

            <li>
              <p className="font-medium">3. Appliquez les migrations</p>
              <p className="mt-1 text-muted-foreground">
                Dans Supabase, ouvrez <em>SQL Editor</em> et exécutez dans l’ordre les
                fichiers du dossier{' '}
                <code className="font-mono">supabase/migrations/</code>.
              </p>
            </li>
          </ol>

          <Alert tone="info">
            Redémarrez ensuite le serveur de développement : les variables
            d’environnement ne sont lues qu’au démarrage.
          </Alert>
        </CardBody>
      </Card>
    </div>
  )
}
