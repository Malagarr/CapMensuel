'use client'

import { LogOut } from 'lucide-react'

import { signOutAction } from '@/app/(auth)/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import type { ButtonProps } from '@/components/ui/button'

/**
 * Déconnexion via un formulaire POST plutôt qu'un lien.
 *
 * Un lien GET serait déclenché par n'importe quel préchargement du navigateur
 * ou balise <img> malveillante, déconnectant l'utilisateur à son insu.
 */
export function SignOutButton({
  variant = 'ghost',
  size = 'sm',
  /** Texte visible. Laisser vide pour n'afficher que l'icône. */
  label = 'Se déconnecter',
}: {
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  label?: string
}) {
  return (
    <form action={signOutAction}>
      <SubmitButton variant={variant} size={size}>
        <LogOut className="size-4" aria-hidden="true" />
        {/* Le bouton conserve toujours un nom accessible, même sans texte visible. */}
        {label ? label : <span className="sr-only">Se déconnecter</span>}
      </SubmitButton>
    </form>
  )
}
