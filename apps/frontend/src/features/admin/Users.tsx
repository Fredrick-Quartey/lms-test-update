// SRS-LDY-F-04: create, edit roles, deactivate (never delete), unlock, password reset, MFA; SoD warning with justification.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, STAFF_ROLES, type Role, type User } from '@ldy/api-client';
import { Alert, Avatar, ErrorAlert, Field, Modal, PageHeader, Pill, QueryState, useToast } from '@/components/ui';
import { ResponsiveTable } from '@/components/ResponsiveTable';
import { dateTime } from '@/lib/format';
import { errorField, errorMessage } from '@/lib/errors';

const sodConflict = (roles: Role[]) => roles.includes('FRONT_DESK') && roles.includes('MANAGER');

export function Users() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['users'], queryFn: api.users.list });
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  return (
    <div>
      <PageHeader title="Users" intro="Accounts are never deleted. Deactivating ends the person's sessions immediately and keeps their history." actions={<button className="btn-primary" onClick={() => setEditing('new')}>Add a staff member</button>} />
      <QueryState q={q}>
        {(users) => (
          <ResponsiveTable
            caption="Staff accounts"
            rows={users}
            rowKey={(u) => u.id}
            columns={[
              { key: 'n', header: 'Name', cell: (u) => <span className="flex items-center gap-2.5"><Avatar name={u.name} size={32} /><span className="font-semibold">{u.name}{u.mfaEnabled && <span className="block text-xs font-normal text-slate">Two-step sign-in on</span>}</span></span> },
              { key: 'u', header: 'Username', cell: (u) => u.username },
              { key: 'r', header: 'Roles', cell: (u) => <>{u.roles.map((r) => t(`roles.${r}`)).join(', ')}{sodConflict(u.roles) && <span className="block text-xs text-warning">Role pair justified: {u.sodJustification}</span>}</> },
              { key: 's', header: 'Status', cell: (u) => <Pill tone={u.status === 'ACTIVE' ? 'good' : u.status === 'LOCKED' ? 'warn' : 'neutral'}>{t(`status:user.${u.status}`)}</Pill> },
              { key: 'l', header: 'Last sign-in', cell: (u) => dateTime(u.lastSignInAt) },
              { key: 'a', header: <span className="sr-only">Actions</span>, cell: (u) => <button className="btn min-h-9 text-sm" onClick={() => setEditing(u)}>Manage</button> },
            ]}
            mobileCard={(u) => (
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setEditing(u)}>
                <Avatar name={u.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block truncate text-sm text-slate">{u.roles.map((r) => t(`roles.${r}`)).join(', ')}</span>
                </span>
                <Pill tone={u.status === 'ACTIVE' ? 'good' : u.status === 'LOCKED' ? 'warn' : 'neutral'}>{t(`status:user.${u.status}`)}</Pill>
              </button>
            )}
          />
        )}
      </QueryState>
      {editing && <UserModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function UserModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ name: user?.name ?? '', username: user?.username ?? '', email: user?.email ?? '', phone: user?.phone ?? '', roles: user?.roles ?? ([] as Role[]), password: '', justification: '', mfa: user?.mfaEnabled ?? false });
  const done = (text: string) => {
    toast(text);
    void qc.invalidateQueries({ queryKey: ['users'] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      user
        ? api.users.update(user.id, { name: f.name, email: f.email, phone: f.phone, roles: f.roles, sodJustification: f.justification || undefined, mfaEnabled: f.mfa })
        : api.users.create({ name: f.name, username: f.username, email: f.email || undefined, phone: f.phone || undefined, roles: f.roles, password: f.password, sodJustification: f.justification || undefined }),
    onSuccess: () => done(user ? 'Changes saved.' : 'Account created. Share the temporary password privately.'),
  });
  const action = useMutation({
    mutationFn: (a: 'deactivate' | 'reactivate' | 'unlock' | 'reset'): Promise<unknown> => (a === 'deactivate' ? api.users.deactivate(user!.id) : a === 'reactivate' ? api.users.reactivate(user!.id) : a === 'unlock' ? api.users.unlock(user!.id) : api.users.sendReset(user!.id)),
    onSuccess: (_d, a) => done({ deactivate: 'Account deactivated and signed out.', reactivate: 'Account reactivated.', unlock: 'Account unlocked.', reset: 'Reset code sent to the registered phone or email.' }[a]),
  });
  const newConflict = sodConflict(f.roles) && !(user && sodConflict(user.roles));
  const err = (k: string) => (errorField(save.error) === k ? errorMessage(save.error) : null);
  const privileged = f.roles.includes('MANAGER') || f.roles.includes('ADMIN');
  return (
    <Modal open onClose={onClose} title={user ? `Manage ${user.name}` : 'Add a staff member'} wide>
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), save.mutate())} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={err('name')}>{(p) => <input {...p} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Username (email or phone)" required error={err('username')} hint={user ? 'Usernames can’t be changed.' : undefined}>{(p) => <input {...p} className="input" value={f.username} disabled={Boolean(user)} onChange={(e) => setF({ ...f, username: e.target.value })} />}</Field>
          <Field label="Email">{(p) => <input {...p} className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Phone">{(p) => <input {...p} className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
          {!user && <Field label="Temporary password" required hint="At least 10 characters. Ask them to change it." error={err('password')}>{(p) => <input {...p} className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}</Field>}
        </div>
        <fieldset>
          <legend className="label">Roles</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {STAFF_ROLES.map((r) => (
              <label key={r} className="flex min-h-10 items-center gap-2">
                <input type="checkbox" checked={f.roles.includes(r)} onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} />
                {t(`roles.${r}`)}
              </label>
            ))}
          </div>
          {err('roles') && <p className="field-error">{err('roles')}</p>}
        </fieldset>
        {newConflict && (
          <Alert tone="warning" title="Segregation of duties">
            <p>With Front Desk and Branch Manager together, one person could take a payment and approve its refund. Transaction-level blocks still apply, but record why this is needed.</p>
            <div className="mt-2">
              <Field label="Justification" required error={err('sodJustification')}>{(p) => <input {...p} className="input" value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} />}</Field>
            </div>
          </Alert>
        )}
        {user && privileged && (
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.mfa} onChange={(e) => setF({ ...f, mfa: e.target.checked })} /> Require two-step sign-in (recommended for managers and administrators)</label>
        )}
        {!errorField(save.error) && <ErrorAlert error={save.error} />}
        <button className="btn-primary" disabled={save.isPending}>{user ? 'Save changes' : 'Create account'}</button>
      </form>
      {user && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="label">Account actions</p>
          <div className="flex flex-wrap gap-2">
            {user.status === 'LOCKED' && <button className="btn" onClick={() => action.mutate('unlock')}>Unlock now</button>}
            <button className="btn" onClick={() => action.mutate('reset')}>Send password reset</button>
            {user.status !== 'DEACTIVATED' ? <button className="btn-danger" onClick={() => action.mutate('deactivate')}>Deactivate</button> : <button className="btn" onClick={() => action.mutate('reactivate')}>Reactivate</button>}
          </div>
          <div className="mt-2"><ErrorAlert error={action.error} /></div>
        </div>
      )}
    </Modal>
  );
}
