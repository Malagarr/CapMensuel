/**
 * Déclarations pour les imports non-JavaScript.
 *
 * Next.js déclare « *.module.css » mais pas les feuilles de style globales.
 * Depuis TypeScript 6, un import d'effet de bord non résolu est une erreur
 * (TS2882) : cette déclaration rétablit `import './globals.css'`.
 */

declare module '*.css'
declare module '*.scss'
declare module '*.sass'
