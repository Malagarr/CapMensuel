'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { buildFingerprint, extractMerchant, normalizeLabel } from '@/lib/banking/normalize'
import type { CategorizationContext } from '@/lib/banking/categorize'
import type { ExistingOperation } from '@/lib/banking/duplicates'
import { errorState, formString, successState, validateForm, type FormState } from '@/lib/forms'
import { getActiveHousehold } from '@/lib/household'
import { canWrite } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { importBatchSchema, saveImportProfileSchema } from '@/lib/validation/import'
import type { ColumnMapping } from '@/lib/banking/detect-columns'

async function requireWriteAccess() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const active = await getActiveHousehold(user)
  if (!active) redirect('/bienvenue')

  return { supabase, user, active, allowed: canWrite(active.role) }
}

const READ_ONLY_MESSAGE =
  'Votre rôle est « lecture seule » : vous ne pouvez pas importer de relevé.'

export type ImportContext = {
  categorization: CategorizationContext
  existingOperations: ExistingOperation[]
}

/**
 * Charge tout ce dont l'assistant d'import a besoin pour tourner dans le
 * navigateur : catégories, règles, mémoire des commerçants, récurrences, et
 * les opérations déjà enregistrées sur ce compte pour la détection de
 * doublons (§11).
 *
 * Volontairement appelée directement depuis le client (pas via un <form>) :
 * c'est un chargement de données, pas une modification.
 */
export async function loadImportContextAction(accountId: string): Promise<ImportContext> {
  const { supabase, active } = await requireWriteAccess()

  const [
    { data: categories },
    { data: rules },
    { data: merchants },
    { data: recurrings },
    { data: existing },
    { data: knownTransactions },
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, category_type, is_active')
      .eq('household_id', active.household.id),
    supabase
      .from('categorization_rules')
      .select('id, match_type, match_value, category_id, account_id, priority, rule_name')
      .eq('household_id', active.household.id)
      .eq('is_active', true),
    supabase
      .from('merchant_categories')
      .select('normalized_merchant, category_id')
      .eq('household_id', active.household.id),
    supabase
      .from('recurring_transactions')
      .select('id, label, category_id, expected_amount')
      .eq('household_id', active.household.id)
      .eq('is_active', true),
    // Doublons : seulement les opérations du compte visé, l'empreinte inclut
    // de toute façon le compte. Bornées aux 3000 plus récentes pour rester
    // rapide sur un très gros historique.
    supabase
      .from('transactions')
      .select('id, bank_account_id, transaction_date, amount, normalized_label, external_id')
      .eq('household_id', active.household.id)
      .eq('bank_account_id', accountId)
      .order('transaction_date', { ascending: false })
      .limit(3000),
    // Libellés déjà classés : sert le niveau 4 de la hiérarchie (§28).
    supabase
      .from('transactions')
      .select('normalized_label, category_id')
      .eq('household_id', active.household.id)
      .not('category_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  // Le plus récent l'emporte : Map écrase les entrées précédentes du même libellé.
  const knownLabels = new Map<string, string>()
  for (const row of (knownTransactions ?? []).reverse()) {
    if (row.normalized_label) knownLabels.set(row.normalized_label, row.category_id!)
  }

  return {
    categorization: {
      categories: (categories ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        categoryType: c.category_type,
        isActive: c.is_active,
      })),
      userRules: (rules ?? []).map((r) => ({
        id: r.id,
        matchType: r.match_type,
        matchValue: r.match_value,
        categoryId: r.category_id,
        accountId: r.account_id,
        priority: r.priority,
        ruleName: r.rule_name,
      })),
      merchants: (merchants ?? []).map((m) => ({
        normalizedMerchant: m.normalized_merchant,
        categoryId: m.category_id,
      })),
      recurrings: (recurrings ?? []).map((r) => ({
        id: r.id,
        normalizedLabel: normalizeLabel(r.label),
        categoryId: r.category_id,
        expectedAmount: Number(r.expected_amount),
      })),
      knownLabels: [...knownLabels.entries()].map(([normalizedLabel, categoryId]) => ({
        normalizedLabel,
        categoryId,
      })),
    },
    existingOperations: (existing ?? []).map((t) => ({
      id: t.id,
      accountId: t.bank_account_id,
      date: t.transaction_date,
      amount: Number(t.amount),
      normalizedLabel: t.normalized_label,
      externalId: t.external_id,
    })),
  }
}

export type RememberedProfile = {
  mapping: ColumnMapping
  dateFormat: 'dmy' | 'mdy' | 'ymd'
  decimalSeparator: ',' | '.'
  hasDebitCredit: boolean
  name: string
}

/**
 * Retrouve un format de fichier déjà mémorisé pour cette banque (§9 étape 3).
 */
export async function findImportProfileAction(
  headerSignature: string,
): Promise<RememberedProfile | null> {
  const { supabase, active } = await requireWriteAccess()

  const { data: profile } = await supabase
    .from('import_profiles')
    .select(
      'id, name, column_mapping, date_format, decimal_separator, has_debit_credit, usage_count',
    )
    .eq('household_id', active.household.id)
    .eq('header_signature', headerSignature)
    .maybeSingle()

  if (!profile) return null

  // Mise à jour de l'usage en tâche de fond : ne bloque pas la réponse.
  void supabase
    .from('import_profiles')
    .update({ usage_count: profile.usage_count + 1, last_used_at: new Date().toISOString() })
    .eq('id', profile.id)
    .then(() => {})

  const dateFormat = profile.date_format
  if (dateFormat !== 'dmy' && dateFormat !== 'mdy' && dateFormat !== 'ymd') return null

  return {
    mapping: profile.column_mapping as ColumnMapping,
    dateFormat,
    decimalSeparator: profile.decimal_separator === '.' ? '.' : ',',
    hasDebitCredit: profile.has_debit_credit,
    name: profile.name,
  }
}

/**
 * Valide et enregistre les opérations sélectionnées dans l'aperçu (§9 étape 5).
 *
 * Les champs dérivés du libellé (normalisation, commerçant, empreinte) sont
 * recalculés côté serveur plutôt que d'être repris tels quels du navigateur :
 * ce sont des fonctions pures et déterministes, autant s'appuyer sur le
 * calcul serveur pour l'intégrité des données plutôt que de faire confiance
 * à ce que le client a envoyé.
 */
export async function commitImportAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const rowsRaw = formString(formData, 'rowsJson')
  let parsedRows: unknown
  try {
    parsedRows = JSON.parse(rowsRaw || '[]')
  } catch {
    return errorState('Les données de l’aperçu sont corrompues. Relancez l’import.')
  }

  const validation = validateForm(importBatchSchema, {
    accountId: formString(formData, 'accountId'),
    fileName: formString(formData, 'fileName'),
    fileType: formString(formData, 'fileType'),
    rows: parsedRows,
  })

  if (!validation.success) return validation.state

  const { supabase, user, active, allowed } = await requireWriteAccess()
  if (!allowed) return errorState(READ_ONLY_MESSAGE)

  const { accountId, fileName, fileType, rows } = validation.data

  const { data: account } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('household_id', active.household.id)
    .maybeSingle()

  if (!account) {
    return errorState('Ce compte n’existe plus, ou n’appartient pas à ce foyer.')
  }

  // Recalcul serveur des champs dérivés, et détermination du sens à partir
  // du signe : négatif = dépense, positif = revenu (convention de l'app).
  const enriched = rows.map((row) => {
    const normalizedLabel = normalizeLabel(row.rawLabel)
    const merchant = extractMerchant(normalizedLabel)
    const fingerprint = buildFingerprint({
      accountId,
      date: row.date,
      amount: row.amount,
      normalizedLabel,
    })
    return { ...row, normalizedLabel, merchant, fingerprint }
  })

  // Toutes les lignes soumises sont voulues : le filtrage « inclure / exclure »
  // a déjà eu lieu côté client dans l'aperçu (§9 étape 4). Seules les lignes
  // cochées par l'utilisateur sont envoyées ici.
  const transactionsToInsert = enriched.map((row) => ({
    household_id: active.household.id,
    bank_account_id: accountId,
    user_id: user.id,
    transaction_date: row.date,
    label: row.rawLabel,
    normalized_label: row.normalizedLabel,
    merchant: row.merchant || null,
    amount: row.amount,
    transaction_type: (row.amount < 0 ? 'expense' : 'income') as 'expense' | 'income',
    category_id: row.categoryId,
    // Sans catégorie, l'opération reste « à vérifier » plutôt que d'être
    // classée par défaut : mieux vaut un badge visible qu'un mauvais classement.
    status: (row.categoryId ? 'cleared' : 'to_review') as 'cleared' | 'to_review',
    source: 'import' as const,
    fingerprint: row.fingerprint,
    confidence_score: null,
    import_file_id: null as string | null,
  }))

  // Le fichier d'import est journalisé même si aucune ligne n'est finalement
  // retenue : le foyer voit ainsi qu'un import a eu lieu, et quand.
  const { data: importFile, error: importFileError } = await supabase
    .from('import_files')
    .insert({
      household_id: active.household.id,
      account_id: accountId,
      created_by: user.id,
      file_name: fileName,
      file_type: fileType,
      total_rows: rows.length,
      imported_rows: transactionsToInsert.length,
      duplicate_rows: rows.filter((r) => r.isDuplicate).length,
      rejected_rows: 0,
      status: 'completed',
    })
    .select('id')
    .single()

  if (importFileError || !importFile) {
    return errorState('L’import n’a pas pu être enregistré. Merci de réessayer.')
  }

  if (transactionsToInsert.length > 0) {
    const { error: insertError } = await supabase.from('transactions').insert(
      transactionsToInsert.map((t) => ({ ...t, import_file_id: importFile.id })),
    )

    if (insertError) {
      return errorState(
        'Les opérations n’ont pas pu être enregistrées. Vérifiez que le compte et les ' +
          'catégories choisies existent toujours.',
      )
    }
  }

  // Apprentissage des corrections (§10) : si l'utilisateur a choisi une
  // catégorie différente de celle suggérée par mot-clé, on la retient pour
  // ce commerçant. Un lot en 1 lecture + 1 écriture plutôt qu'une requête
  // par opération corrigée.
  const corrections = enriched.filter(
    (row) => row.categoryId && row.merchant && row.rememberMerchant,
  )

  if (corrections.length > 0) {
    const merchantNames = [...new Set(corrections.map((row) => row.merchant))]

    const { data: existingMemory } = await supabase
      .from('merchant_categories')
      .select('normalized_merchant, hit_count')
      .eq('household_id', active.household.id)
      .in('normalized_merchant', merchantNames)

    const hitCounts = new Map((existingMemory ?? []).map((m) => [m.normalized_merchant, m.hit_count]))

    // Une seule mémorisation par commerçant : la dernière correction gagne.
    const byMerchant = new Map(corrections.map((row) => [row.merchant, row]))

    await supabase.from('merchant_categories').upsert(
      [...byMerchant.entries()].map(([merchant, row]) => ({
        household_id: active.household.id,
        normalized_merchant: merchant,
        category_id: row.categoryId!,
        hit_count: (hitCounts.get(merchant) ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })),
      { onConflict: 'household_id,normalized_merchant' },
    )
  }

  // Mémorisation du format du fichier, si demandée (§9 étape 3).
  const shouldSaveProfile = formString(formData, 'saveProfile') === 'on'
  if (shouldSaveProfile) {
    const profileValidation = validateForm(saveImportProfileSchema, {
      name: formString(formData, 'profileName'),
      headerSignature: formString(formData, 'headerSignature'),
      columnMapping: JSON.parse(formString(formData, 'columnMappingJson') || '{}'),
      dateFormat: formString(formData, 'dateFormat'),
      decimalSeparator: formString(formData, 'decimalSeparator'),
      hasDebitCredit: formString(formData, 'hasDebitCredit') === 'on',
    })

    if (profileValidation.success) {
      const profile = profileValidation.data
      await supabase.from('import_profiles').upsert(
        {
          household_id: active.household.id,
          name: profile.name,
          header_signature: profile.headerSignature,
          column_mapping: profile.columnMapping,
          date_format: profile.dateFormat,
          decimal_separator: profile.decimalSeparator,
          has_debit_credit: profile.hasDebitCredit,
          usage_count: 1,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'household_id,header_signature' },
      )
    }
  }

  revalidatePath('/operations')
  revalidatePath('/comptes')
  revalidatePath('/tableau-de-bord')

  const message =
    transactionsToInsert.length === 0
      ? 'Aucune opération n’a été importée.'
      : `${transactionsToInsert.length} opération${transactionsToInsert.length > 1 ? 's' : ''} importée${transactionsToInsert.length > 1 ? 's' : ''}.`

  return successState(message)
}
