'use client'

import { useFormStatus } from 'react-dom'

import { Button, type ButtonProps } from '@/components/ui/button'

/**
 * Bouton d'envoi qui se désactive automatiquement pendant la soumission.
 *
 * useFormStatus lit l'état du <form> parent : le composant doit donc être
 * rendu à l'intérieur du formulaire, jamais au même niveau.
 */
export function SubmitButton({ children, ...props }: ButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  )
}
