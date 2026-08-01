import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { InviteForm, type InvitationRow } from '@/app/(app)/foyer/invite-form'
import { MemberList, type MemberRow } from '@/app/(app)/foyer/member-list'
import { RenameHouseholdForm } from '@/app/(app)/foyer/rename-form'
import { Alert } from '@/components/ui/alert'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { getSiteUrl } from '@/lib/env'
import { formatRelative } from '@/lib/format'
import { requireActiveHousehold } from '@/lib/household'
import { canManageHousehold } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Foyer' }

/** Traduction des actions consignées dans le journal d'audit. */
const auditActionLabels: Record<string, string> = {
  insert: 'a ajouté',
  update: 'a modifié',
  delete: 'a supprimé',
}

const auditResourceLabels: Record<string, string> = {
  transactions: 'une opération',
  bank_accounts: 'un compte bancaire',
  category_budgets: 'un budget',
  household_members: 'un membre du foyer',
}

export default async function HouseholdPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const { household, role } = await requireActiveHousehold(user)
  const canManage = canManageHousehold(role)

  // Membres, avec leur profil.
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('id, user_id, role, joined_at, user:users(first_name, last_name, email)')
    .eq('household_id', household.id)
    .order('joined_at', { ascending: true })

  const members: MemberRow[] = (memberRows ?? []).map((row) => ({
    memberId: row.id,
    userId: row.user_id,
    firstName: row.user?.first_name ?? null,
    lastName: row.user?.last_name ?? null,
    email: row.user?.email ?? '—',
    role: row.role,
    joinedAt: row.joined_at,
    isOwner: row.user_id === household.owner_id,
  }))

  // Invitations jamais utilisées, expirées comprises.
  //
  // Les expirées sont affichées volontairement : les masquer les laisserait
  // s'accumuler en base sans aucun moyen de les supprimer depuis l'interface.
  // Elles ne sont lisibles que par un administrateur (politique RLS).
  let invitations: InvitationRow[] = []
  if (canManage) {
    const { data } = await supabase
      .from('household_invitations')
      .select('id, code, email, role, expires_at, created_at')
      .eq('household_id', household.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    const now = Date.now()

    invitations = (data ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at,
      isExpired: new Date(row.expires_at).getTime() <= now,
    }))
  }

  // Activité récente, issue du journal d'audit alimenté par déclencheur.
  const { data: activity } = await supabase
    .from('audit_logs')
    .select('id, action, resource_type, created_at, user_id')
    .eq('household_id', household.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const memberNames = new Map(
    members.map((member) => [
      member.userId,
      [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email,
    ]),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Foyer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les membres, leurs droits et l’activité récente du foyer {household.name}.
        </p>
      </div>

      {!canManage && (
        <Alert tone="info">
          Vous pouvez consulter la composition du foyer. Seul un administrateur peut
          inviter, retirer un membre ou modifier des droits.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`Membres (${members.length})`}
          description="Chaque opération enregistrée indique qui l’a saisie."
        />
        <CardBody className="pt-2">
          <MemberList members={members} currentUserId={user.id} canManage={canManage} />
        </CardBody>
      </Card>

      {canManage && (
        <Card>
          <CardHeader
            title="Inviter quelqu’un"
            description="Générez un code, puis transmettez-le par le moyen de votre choix."
          />
          <CardBody className="pt-2">
            <InviteForm
              householdId={household.id}
              invitations={invitations}
              joinUrlBase={getSiteUrl()}
            />
          </CardBody>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader title="Nom du foyer" />
          <CardBody className="pt-2">
            <RenameHouseholdForm householdId={household.id} currentName={household.name} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Activité récente"
          description="Journal des modifications importantes, non modifiable."
        />
        <CardBody className="pt-2">
          {(activity ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune activité pour l’instant. Elle apparaîtra dès les premières
              opérations enregistrées.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(activity ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-wrap gap-x-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {entry.user_id ? (memberNames.get(entry.user_id) ?? 'Quelqu’un') : 'Le système'}
                  </span>
                  <span>{auditActionLabels[entry.action] ?? entry.action}</span>
                  <span>{auditResourceLabels[entry.resource_type] ?? entry.resource_type}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={entry.created_at}>{formatRelative(entry.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
