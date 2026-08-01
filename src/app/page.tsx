import Link from 'next/link'
import {
  ArrowRight,
  FileSpreadsheet,
  PieChart,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { buttonClasses } from '@/components/ui/button-styles'
import { Card, CardBody } from '@/components/ui/card'

const features = [
  {
    icon: Wallet,
    title: 'Votre reste à vivre, en un coup d’œil',
    description:
      'Revenus, dépenses, épargne et budget quotidien restant, calculés automatiquement pour le mois en cours.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Importez votre relevé bancaire',
    description:
      'Déposez un fichier CSV ou Excel : les colonnes sont détectées, les opérations classées, les doublons écartés.',
  },
  {
    icon: PieChart,
    title: 'Des budgets qui vous alertent',
    description:
      'Fixez un plafond par catégorie et voyez immédiatement où vous en êtes, avant le dépassement.',
  },
  {
    icon: Users,
    title: 'À plusieurs, sans confusion',
    description:
      'Partagez le budget du foyer. Chacun voit qui a ajouté quoi, avec les droits que vous décidez.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2 font-semibold">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Wallet className="size-4.5" />
          </span>
          Budget Foyer
        </span>
        <ThemeToggle />
      </header>

      <main id="contenu-principal" className="mx-auto max-w-5xl px-5 pb-20">
        <section className="animate-slide-up py-12 sm:py-20">
          <p className="text-sm font-medium text-primary">
            Budget personnel et familial
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            Savoir ce qu’il vous reste, sans y passer vos soirées.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Une application simple pour suivre les revenus et les dépenses du foyer,
            importer ses relevés bancaires et anticiper la fin du mois.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inscription"
              className={buttonClasses({ size: 'lg', className: 'px-6' })}
            >
              Créer mon compte
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/connexion"
              className={buttonClasses({ variant: 'outline', size: 'lg', className: 'px-6' })}
            >
              J’ai déjà un compte
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardBody>
                <span
                  className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary"
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardBody>
            </Card>
          ))}
        </section>

        <section className="mt-10 flex items-start gap-3 rounded-app border border-border bg-muted/50 p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Vos données restent les vôtres.</span>{' '}
            Les fichiers bancaires sont analysés directement dans votre navigateur : seules
            les opérations que vous validez sont enregistrées. Vous pouvez exporter ou
            supprimer l’ensemble de vos données à tout moment.
          </p>
        </section>
      </main>
    </div>
  )
}
