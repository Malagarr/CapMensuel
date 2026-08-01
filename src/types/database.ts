/**
 * Types de la base de données.
 *
 * Ce fichier reflète les migrations de supabase/migrations/. Il est écrit à la
 * main, mais reste régénérable :
 *
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * Toute modification du schéma SQL doit être répercutée ici, sinon les
 * requêtes ne seront plus typées correctement.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ---------------------------------------------------------------------------
// Types énumérés
// ---------------------------------------------------------------------------

export type MemberRole = 'admin' | 'member' | 'viewer'

export type AccountType =
  | 'checking'
  | 'joint'
  | 'personal'
  | 'savings'
  | 'business'
  | 'child'
  | 'deferred_card'
  | 'other'

export type CategoryKind =
  | 'income'
  | 'fixed_expense'
  | 'variable_expense'
  | 'exceptional_expense'
  | 'savings'
  | 'transfer'

export type TransactionType = 'income' | 'expense' | 'internal_transfer'

export type TransactionStatus =
  | 'planned'
  | 'pending'
  | 'cleared'
  | 'to_review'
  | 'cancelled'
  | 'rejected'

export type PaymentMethod =
  | 'card'
  | 'deferred_card'
  | 'direct_debit'
  | 'transfer'
  | 'check'
  | 'cash'
  | 'fee'
  | 'other'

export type TransactionSource = 'manual' | 'import' | 'recurring' | 'demo'

export type RecurrenceFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'one_off'

export type ImportStatus =
  | 'analyzing'
  | 'mapping'
  | 'preview'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type DuplicateStatus = 'new' | 'duplicate' | 'similar' | 'forced'

export type RowValidationStatus =
  | 'pending'
  | 'validated'
  | 'ignored'
  | 'imported'
  | 'failed'

export type RuleMatchType = 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex'

export type NotificationType =
  | 'budget_exceeded'
  | 'budget_warning'
  | 'large_upcoming_debit'
  | 'negative_balance_forecast'
  | 'income_missing'
  | 'unusual_expense'
  | 'unrecognized_transaction'
  | 'import_completed'
  | 'savings_goal_reached'
  | 'recurring_due'

// ---------------------------------------------------------------------------
// Schéma
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
        }
        Update: {
          email?: string
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
        }
        Relationships: []
      }

      households: {
        Row: {
          id: string
          name: string
          owner_id: string
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          currency?: string
        }
        Update: {
          name?: string
          currency?: string
        }
        Relationships: []
      }

      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string
          role: MemberRole
          joined_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id: string
          role?: MemberRole
        }
        Update: {
          role?: MemberRole
        }
        // Déclarer les clés étrangères permet à supabase-js de typer les
        // requêtes imbriquées, par exemple :
        //   .select('role, user:users(first_name, last_name)')
        Relationships: [
          {
            foreignKeyName: 'household_members_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'household_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }

      household_invitations: {
        Row: {
          id: string
          household_id: string
          code: string
          email: string | null
          role: MemberRole
          invited_by: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          code: string
          email?: string | null
          role?: MemberRole
          invited_by: string
          expires_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'household_invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }

      user_settings: {
        Row: {
          user_id: string
          notification_settings: Json
          auto_logout_minutes: number | null
          delete_import_file: boolean
          last_household_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          notification_settings?: Json
          auto_logout_minutes?: number | null
          delete_import_file?: boolean
          last_household_id?: string | null
        }
        Update: {
          notification_settings?: Json
          auto_logout_minutes?: number | null
          delete_import_file?: boolean
          last_household_id?: string | null
        }
        Relationships: []
      }

      bank_accounts: {
        Row: {
          id: string
          household_id: string
          owner_user_id: string | null
          name: string
          bank_name: string | null
          account_type: AccountType
          initial_balance: number
          currency: string
          color: string
          icon: string
          is_shared: boolean
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          owner_user_id?: string | null
          name: string
          bank_name?: string | null
          account_type?: AccountType
          initial_balance?: number
          currency?: string
          color?: string
          icon?: string
          is_shared?: boolean
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          owner_user_id?: string | null
          name?: string
          bank_name?: string | null
          account_type?: AccountType
          initial_balance?: number
          currency?: string
          color?: string
          icon?: string
          is_shared?: boolean
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }

      categories: {
        Row: {
          id: string
          household_id: string
          name: string
          category_type: CategoryKind
          icon: string
          color: string
          parent_category_id: string | null
          is_active: boolean
          is_system: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          category_type: CategoryKind
          icon?: string
          color?: string
          parent_category_id?: string | null
          is_active?: boolean
          is_system?: boolean
          sort_order?: number
        }
        Update: {
          name?: string
          category_type?: CategoryKind
          icon?: string
          color?: string
          parent_category_id?: string | null
          is_active?: boolean
          sort_order?: number
        }
        Relationships: []
      }

      recurring_transactions: {
        Row: {
          id: string
          household_id: string
          account_id: string
          category_id: string | null
          label: string
          expected_amount: number
          transaction_type: TransactionType
          frequency: RecurrenceFrequency
          day_of_month: number | null
          next_date: string
          start_date: string
          end_date: string | null
          amount_is_variable: boolean
          beneficiary: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          account_id: string
          category_id?: string | null
          label: string
          expected_amount: number
          transaction_type: TransactionType
          frequency?: RecurrenceFrequency
          day_of_month?: number | null
          next_date: string
          start_date?: string
          end_date?: string | null
          amount_is_variable?: boolean
          beneficiary?: string | null
          is_active?: boolean
        }
        Update: {
          account_id?: string
          category_id?: string | null
          label?: string
          expected_amount?: number
          transaction_type?: TransactionType
          frequency?: RecurrenceFrequency
          day_of_month?: number | null
          next_date?: string
          start_date?: string
          end_date?: string | null
          amount_is_variable?: boolean
          beneficiary?: string | null
          is_active?: boolean
        }
        Relationships: []
      }

      category_budgets: {
        Row: {
          id: string
          household_id: string
          category_id: string
          year: number
          month: number
          planned_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          category_id: string
          year: number
          month: number
          planned_amount: number
        }
        Update: {
          planned_amount?: number
        }
        Relationships: []
      }

      import_profiles: {
        Row: {
          id: string
          household_id: string
          name: string
          bank_name: string | null
          header_signature: string
          column_mapping: Json
          date_format: string | null
          decimal_separator: string
          has_debit_credit: boolean
          usage_count: number
          last_used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          bank_name?: string | null
          header_signature: string
          column_mapping: Json
          date_format?: string | null
          decimal_separator?: string
          has_debit_credit?: boolean
          usage_count?: number
          last_used_at?: string | null
        }
        Update: {
          name?: string
          bank_name?: string | null
          column_mapping?: Json
          date_format?: string | null
          decimal_separator?: string
          has_debit_credit?: boolean
          usage_count?: number
          last_used_at?: string | null
        }
        Relationships: []
      }

      import_files: {
        Row: {
          id: string
          household_id: string
          account_id: string
          profile_id: string | null
          created_by: string | null
          file_name: string
          file_type: string
          file_size: number | null
          import_date: string
          total_rows: number
          imported_rows: number
          duplicate_rows: number
          rejected_rows: number
          status: ImportStatus
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          account_id: string
          profile_id?: string | null
          created_by?: string | null
          file_name: string
          file_type: string
          file_size?: number | null
          total_rows?: number
          imported_rows?: number
          duplicate_rows?: number
          rejected_rows?: number
          status?: ImportStatus
          error_message?: string | null
        }
        Update: {
          profile_id?: string | null
          total_rows?: number
          imported_rows?: number
          duplicate_rows?: number
          rejected_rows?: number
          status?: ImportStatus
          error_message?: string | null
        }
        Relationships: []
      }

      transactions: {
        Row: {
          id: string
          household_id: string
          bank_account_id: string
          user_id: string | null
          member_user_id: string | null
          transaction_date: string
          value_date: string | null
          label: string
          normalized_label: string
          merchant: string | null
          amount: number
          transaction_type: TransactionType
          payment_method: PaymentMethod | null
          category_id: string | null
          status: TransactionStatus
          source: TransactionSource
          external_id: string | null
          fingerprint: string
          confidence_score: number | null
          transfer_group_id: string | null
          recurring_transaction_id: string | null
          import_file_id: string | null
          notes: string | null
          receipt_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          bank_account_id: string
          user_id?: string | null
          member_user_id?: string | null
          transaction_date: string
          value_date?: string | null
          label: string
          normalized_label?: string
          merchant?: string | null
          amount: number
          transaction_type: TransactionType
          payment_method?: PaymentMethod | null
          category_id?: string | null
          status?: TransactionStatus
          source?: TransactionSource
          external_id?: string | null
          fingerprint: string
          confidence_score?: number | null
          transfer_group_id?: string | null
          recurring_transaction_id?: string | null
          import_file_id?: string | null
          notes?: string | null
          receipt_url?: string | null
        }
        Update: {
          bank_account_id?: string
          member_user_id?: string | null
          transaction_date?: string
          value_date?: string | null
          label?: string
          normalized_label?: string
          merchant?: string | null
          amount?: number
          transaction_type?: TransactionType
          payment_method?: PaymentMethod | null
          category_id?: string | null
          status?: TransactionStatus
          external_id?: string | null
          fingerprint?: string
          confidence_score?: number | null
          transfer_group_id?: string | null
          notes?: string | null
          receipt_url?: string | null
        }
        Relationships: []
      }

      import_rows: {
        Row: {
          id: string
          import_file_id: string
          household_id: string
          row_number: number
          raw_date: string | null
          raw_label: string | null
          raw_amount: string | null
          parsed_date: string | null
          parsed_amount: number | null
          normalized_label: string | null
          suggested_category_id: string | null
          confidence_score: number | null
          fingerprint: string | null
          duplicate_status: DuplicateStatus
          duplicate_of: string | null
          validation_status: RowValidationStatus
          transaction_id: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          import_file_id: string
          household_id: string
          row_number: number
          raw_date?: string | null
          raw_label?: string | null
          raw_amount?: string | null
          parsed_date?: string | null
          parsed_amount?: number | null
          normalized_label?: string | null
          suggested_category_id?: string | null
          confidence_score?: number | null
          fingerprint?: string | null
          duplicate_status?: DuplicateStatus
          duplicate_of?: string | null
          validation_status?: RowValidationStatus
          transaction_id?: string | null
          error_message?: string | null
        }
        Update: {
          suggested_category_id?: string | null
          confidence_score?: number | null
          duplicate_status?: DuplicateStatus
          validation_status?: RowValidationStatus
          transaction_id?: string | null
          error_message?: string | null
        }
        Relationships: []
      }

      categorization_rules: {
        Row: {
          id: string
          household_id: string
          rule_name: string
          match_type: RuleMatchType
          match_value: string
          category_id: string
          account_id: string | null
          priority: number
          is_active: boolean
          created_by: string | null
          hit_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          rule_name: string
          match_type?: RuleMatchType
          match_value: string
          category_id: string
          account_id?: string | null
          priority?: number
          is_active?: boolean
          created_by?: string | null
          hit_count?: number
        }
        Update: {
          rule_name?: string
          match_type?: RuleMatchType
          match_value?: string
          category_id?: string
          account_id?: string | null
          priority?: number
          is_active?: boolean
          hit_count?: number
        }
        Relationships: []
      }

      merchant_categories: {
        Row: {
          id: string
          household_id: string
          normalized_merchant: string
          category_id: string
          hit_count: number
          last_used_at: string
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          normalized_merchant: string
          category_id: string
          hit_count?: number
          last_used_at?: string
        }
        Update: {
          category_id?: string
          hit_count?: number
          last_used_at?: string
        }
        Relationships: []
      }

      savings_goals: {
        Row: {
          id: string
          household_id: string
          name: string
          target_amount: number
          current_amount: number
          target_date: string | null
          account_id: string | null
          monthly_contribution: number | null
          icon: string
          color: string
          is_achieved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          household_id: string
          name: string
          target_amount: number
          current_amount?: number
          target_date?: string | null
          account_id?: string | null
          monthly_contribution?: number | null
          icon?: string
          color?: string
          is_achieved?: boolean
        }
        Update: {
          name?: string
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          account_id?: string | null
          monthly_contribution?: number | null
          icon?: string
          color?: string
          is_achieved?: boolean
        }
        Relationships: []
      }

      notifications: {
        Row: {
          id: string
          household_id: string
          user_id: string | null
          notification_type: NotificationType
          title: string
          message: string
          payload: Json
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id?: string | null
          notification_type: NotificationType
          title: string
          message: string
          payload?: Json
          is_read?: boolean
        }
        Update: {
          is_read?: boolean
        }
        Relationships: []
      }

      audit_logs: {
        Row: {
          id: string
          household_id: string | null
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          details: Json
          created_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }

    Views: {
      account_balances: {
        Row: {
          account_id: string
          household_id: string
          name: string
          currency: string
          initial_balance: number
          current_balance: number
          projected_balance: number
          cleared_count: number
        }
        Relationships: []
      }
    }

    Functions: {
      create_household: {
        Args: { household_name: string; household_currency?: string }
        Returns: string
      }
      create_household_invitation: {
        Args: {
          target_household_id: string
          invitee_email?: string | null
          invitee_role?: MemberRole
        }
        Returns: string
      }
      accept_household_invitation: {
        Args: { invitation_code: string }
        Returns: string
      }
      is_household_member: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      household_role: {
        Args: { target_household_id: string }
        Returns: MemberRole
      }
      can_write_household: {
        Args: { target_household_id: string }
        Returns: boolean
      }
      is_household_admin: {
        Args: { target_household_id: string }
        Returns: boolean
      }
    }

    Enums: {
      member_role: MemberRole
      account_type: AccountType
      category_kind: CategoryKind
      transaction_type: TransactionType
      transaction_status: TransactionStatus
      payment_method: PaymentMethod
      transaction_source: TransactionSource
      recurrence_frequency: RecurrenceFrequency
      import_status: ImportStatus
      duplicate_status: DuplicateStatus
      row_validation_status: RowValidationStatus
      rule_match_type: RuleMatchType
      notification_type: NotificationType
    }

    CompositeTypes: Record<never, never>
  }
}

// ---------------------------------------------------------------------------
// Raccourcis pratiques
// ---------------------------------------------------------------------------

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type UserProfile = Tables<'users'>
export type Household = Tables<'households'>
export type HouseholdMember = Tables<'household_members'>
export type HouseholdInvitation = Tables<'household_invitations'>
export type UserSettings = Tables<'user_settings'>
export type BankAccount = Tables<'bank_accounts'>
export type Category = Tables<'categories'>
export type RecurringTransaction = Tables<'recurring_transactions'>
export type CategoryBudget = Tables<'category_budgets'>
export type ImportProfile = Tables<'import_profiles'>
export type ImportFile = Tables<'import_files'>
export type Transaction = Tables<'transactions'>
export type ImportRow = Tables<'import_rows'>
export type CategorizationRule = Tables<'categorization_rules'>
export type MerchantCategory = Tables<'merchant_categories'>
export type SavingsGoal = Tables<'savings_goals'>
export type Notification = Tables<'notifications'>
export type AuditLog = Tables<'audit_logs'>
export type AccountBalance = PublicSchema['Views']['account_balances']['Row']
