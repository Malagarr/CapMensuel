import { z } from 'zod'

/** Validation de la ligne d'import finale, envoyée après l'aperçu (§9 étape 5). */
export const importRowSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide' }),
  rawLabel: z.string().min(1).max(255),
  normalizedLabel: z.string().max(255),
  merchant: z.string().max(120),
  amount: z.number().finite().refine((value) => value !== 0, {
    message: 'Le montant ne peut pas être nul',
  }),
  categoryId: z
    .string()
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value))
    .refine((value) => value === null || z.uuid().safeParse(value).success, {
      message: 'Catégorie inconnue',
    }),
  fingerprint: z.string().min(1),
  isDuplicate: z.boolean(),
  /** L'utilisateur a changé la catégorie proposée : mémoriser ce choix pour ce commerçant. */
  rememberMerchant: z.boolean(),
})

export const importBatchSchema = z.object({
  accountId: z.uuid({ message: 'Choisissez un compte' }),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['csv', 'xlsx', 'xlsm']),
  rows: z.array(importRowSchema).min(1, { message: 'Aucune opération à importer' }).max(5000),
})

export const saveImportProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  headerSignature: z.string().min(1).max(2000),
  columnMapping: z.record(z.string(), z.number()),
  dateFormat: z.enum(['dmy', 'mdy', 'ymd']),
  decimalSeparator: z.enum([',', '.']),
  hasDebitCredit: z.boolean(),
})

export type ImportBatchInput = z.infer<typeof importBatchSchema>
