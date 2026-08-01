import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// eslint-config-next est encore au format « eslintrc » : FlatCompat fait le pont
// avec le format « flat config » attendu par ESLint 9.
const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'coverage/**',
      'next-env.d.ts',
      'public/sw.js',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Les variables inutilisées sont une erreur, sauf si préfixées par « _ ».
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // « any » masque les erreurs de typage sur des données financières : on avertit.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]

export default config
