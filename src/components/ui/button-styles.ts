import { cn } from '@/lib/utils'

/**
 * Styles des boutons, isolés dans un module sans directive « use client ».
 *
 * Un Server Component ne peut pas appeler une fonction exportée par un module
 * client : ses exports deviennent de simples références. En plaçant ces
 * utilitaires ici, les pages serveur peuvent styler un <Link> comme un bouton.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-muted text-foreground hover:bg-border active:brightness-95',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 shadow-sm',
}

export const buttonSizeClasses: Record<ButtonSize, string> = {
  // Hauteur minimale de 44 px sur les tailles md et au-delà : cible tactile
  // confortable, conformément à la recommandation WCAG 2.5.5.
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-11 w-11 justify-center',
}

/**
 * Renvoie les classes d'un bouton, pour styler un élément qui n'est pas un
 * <button> — typiquement un <Link> de navigation. Imbriquer un lien dans un
 * bouton produirait du HTML invalide et déroute les lecteurs d'écran.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  className?: string
} = {}): string {
  return cn(
    'inline-flex items-center rounded-xl font-medium transition-[filter,background-color] duration-150',
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    block ? 'w-full justify-center' : 'justify-center',
    className,
  )
}
