import {
  ArrowLeftRight,
  Award,
  Baby,
  Briefcase,
  Building2,
  Car,
  CirclePlus,
  Circle,
  CircleEllipsis,
  CreditCard,
  Droplet,
  Flame,
  Fuel,
  Gamepad2,
  Gift,
  HandCoins,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
  PawPrint,
  PiggyBank,
  Repeat,
  Scale,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  TrainFront,
  TreePalm,
  Undo2,
  UserRound,
  Users,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Registre d'icônes.
 *
 * Les icônes sont importées nommément plutôt que via `import { icons }` :
 * cet import global embarquerait le millier d'icônes de la bibliothèque dans
 * le paquet envoyé au navigateur. Ici, seules celles réellement utilisées
 * sont incluses.
 *
 * Les clés correspondent aux valeurs stockées en base (colonnes `icon`).
 */
export const iconRegistry = {
  // Comptes bancaires
  wallet: Wallet,
  users: Users,
  'user-round': UserRound,
  'piggy-bank': PiggyBank,
  briefcase: Briefcase,
  baby: Baby,
  'credit-card': CreditCard,
  landmark: Landmark,
  'building-2': Building2,

  // Catégories de revenus
  award: Award,
  'hand-coins': HandCoins,
  'undo-2': Undo2,
  sparkles: Sparkles,
  'circle-plus': CirclePlus,

  // Catégories de dépenses
  house: House,
  'key-round': KeyRound,
  zap: Zap,
  droplet: Droplet,
  flame: Flame,
  shield: Scale,
  smartphone: Smartphone,
  wifi: Wifi,
  repeat: Repeat,
  scale: Scale,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  fuel: Fuel,
  'train-front': TrainFront,
  car: Car,
  'heart-pulse': HeartPulse,
  shirt: Shirt,
  'gamepad-2': Gamepad2,
  'paw-print': PawPrint,
  gift: Gift,
  'circle-ellipsis': CircleEllipsis,
  palmtree: TreePalm,
  hammer: Wrench,
  'arrow-left-right': ArrowLeftRight,
  target: Target,

  // Repli
  circle: Circle,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof iconRegistry

/** Vrai si le nom correspond à une icône connue. */
export function isKnownIcon(name: string): name is IconName {
  return name in iconRegistry
}

/**
 * Affiche une icône à partir de son nom.
 * Un nom inconnu retombe sur un cercle plutôt que de casser le rendu.
 */
export function Icon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Component = isKnownIcon(name) ? iconRegistry[name] : Circle
  return <Component className={className} aria-hidden="true" />
}
