import { ImageResponse } from 'next/og'

/**
 * Génère les icônes de l'application à la volée (§17), plutôt que de
 * maintenir des fichiers PNG statiques : une seule source de vérité pour la
 * couleur de marque et le glyphe, réutilisée par le favicon, l'icône Apple
 * et les icônes du manifeste PWA (standards et « maskable »).
 */
const BACKGROUND = '#008589'
const FOREGROUND = '#f7fdfd'

export function renderAppIcon(size: number, { maskable = false } = {}) {
  // Les icônes « maskable » peuvent être recadrées en cercle par le système :
  // le glyphe doit rester dans la zone de sécurité centrale (~80 % du carré).
  const padding = maskable ? size * 0.28 : size * 0.18

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BACKGROUND,
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: size - padding * 2,
            height: size - padding * 2,
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size - padding * 2,
            fontWeight: 700,
            color: FOREGROUND,
            fontFamily: 'sans-serif',
            lineHeight: 1,
          }}
        >
          €
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
