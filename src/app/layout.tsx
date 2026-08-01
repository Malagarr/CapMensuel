import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import { ThemeProvider, themeInitScript } from '@/components/theme-provider'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Budget Foyer',
    template: '%s · Budget Foyer',
  },
  description:
    'Suivez vos revenus, vos dépenses et votre reste à vivre. Simple, clair, à plusieurs.',
  applicationName: 'Budget Foyer',
  // Les pages d'une application financière ne doivent jamais être indexées.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // On n'interdit pas le zoom : le bloquer est une faute d'accessibilité.
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1f26' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique le thème avant le premier rendu pour éviter le flash blanc. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <a
          href="#contenu-principal"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Aller au contenu principal
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
