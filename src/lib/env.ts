import { z } from 'zod'

/**
 * Validation des variables d'environnement.
 *
 * Une clé Supabase absente ou mal collée produit sinon une erreur obscure au
 * premier appel réseau. On échoue ici, au démarrage, avec un message explicite.
 *
 * Les variables NEXT_PUBLIC_* sont remplacées à la compilation par Next.js :
 * elles doivent être référencées littéralement (process.env.NEXT_PUBLIC_X) et
 * jamais via un accès dynamique.
 */

/**
 * Fragments présents dans .env.example, jamais dans une vraie valeur.
 *
 * Sans ce contrôle, un fichier .env.local recopié mais non complété passerait
 * la validation : l'application tenterait alors de joindre un domaine
 * inexistant et échouerait bien plus loin, avec un message incompréhensible.
 */
const PLACEHOLDER_MARKERS = [
  'remplacez',
  'placeholder',
  'votreprojet',
  'xxxxxxxx',
  'eyjhbgcioi...',
]

function looksLikePlaceholder(value: string): boolean {
  const normalized = value.toLowerCase()
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))
}

const notAPlaceholder = (fieldName: string) =>
  z.string().refine((value) => !looksLikePlaceholder(value), {
    message: `${fieldName} contient encore la valeur d'exemple : remplacez-la par votre vraie valeur`,
  })

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url({
      message:
        'NEXT_PUBLIC_SUPABASE_URL doit être une URL valide (https://xxx.supabase.co)',
    })
    .and(notAPlaceholder('NEXT_PUBLIC_SUPABASE_URL')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, { message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY semble incomplète' })
    .and(notAPlaceholder('NEXT_PUBLIC_SUPABASE_ANON_KEY')),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
})

type PublicEnv = z.infer<typeof publicSchema>

let cachedEnv: PublicEnv | null = null

/**
 * Lit et valide la configuration publique.
 *
 * La validation est différée au premier appel plutôt qu'exécutée à l'import :
 * une vérification à l'import ferait échouer `next build` sur une machine de
 * compilation sans secrets, alors que le problème n'est pas le code. Ici,
 * l'erreur survient à la première requête, avec un message actionnable.
 */
export function getEnv(): PublicEnv {
  if (cachedEnv) return cachedEnv

  const parsed = publicSchema.safeParse({
    // Ces trois accès doivent rester littéraux : Next.js les remplace par leur
    // valeur à la compilation, ce qu'un accès dynamique empêcherait.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  })

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')} : ${issue.message}`)
      .join('\n')
    throw new Error(
      `Configuration incomplète. Copiez .env.example en .env.local et renseignez :\n${details}`,
    )
  }

  cachedEnv = parsed.data
  return cachedEnv
}

/**
 * Indique si la configuration Supabase est présente, sans lever d'exception.
 *
 * Sert au middleware : au tout premier lancement, mieux vaut afficher une page
 * expliquant quoi faire qu'une erreur 500 sur chaque route.
 */
export function isConfigured(): boolean {
  try {
    getEnv()
    return true
  } catch {
    return false
  }
}

/**
 * URL publique du site, utilisée pour construire les liens envoyés par e-mail.
 * En production sur Vercel, VERCEL_URL est fournie automatiquement.
 */
export function getSiteUrl(): string {
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL
  if (siteUrl) return siteUrl
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/**
 * Clé « service_role », réservée au serveur.
 *
 * Elle contourne la Row Level Security. Cette fonction lève une erreur si elle
 * est appelée depuis le navigateur, pour rendre impossible une fuite par
 * inadvertance dans un composant client.
 */
export function getServiceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error(
      'La clé service_role ne doit jamais être lue côté navigateur.',
    )
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || key.length < 20) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY est absente. Elle est nécessaire aux scripts ' +
        "d'administration (données de démonstration, suppression de compte).",
    )
  }
  return key
}
