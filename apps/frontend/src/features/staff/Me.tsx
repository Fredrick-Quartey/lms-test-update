// Phone-friendly account page for staff (REDESIGN §4, §9: the "Me" tab). Sign-out is confirmed (D10).
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, KeyRound, LogOut } from 'lucide-react';
import { api } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { navFor } from '@/auth/permissions';
import { useSettings } from '@/config/settings';
import { useSignOutConfirm } from '@/components/layout';
import { Avatar, Empty, PageHeader, QueryState, Section } from '@/components/ui';
import { dateTime } from '@/lib/format';

export function Me() {
  const { t } = useTranslation();
  const { user, activeRole, setActiveRole } = useAuth();
  const settings = useSettings();
  const signout = useSignOutConfirm();
  const roles = (user?.roles ?? []).filter((r) => r !== 'CUSTOMER');
  const more = navFor(activeRole, settings.data?.features);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="My account" />
      <Section>
        <div className="flex items-center gap-4">
          <Avatar name={user?.name} size={56} />
          <div className="min-w-0">
            <p className="text-lg font-bold">{user?.name}</p>
            <p className="truncate text-sm text-slate">{user?.username}</p>
            <p className="text-sm font-semibold text-blue">{activeRole && t(`roles.${activeRole}`)}</p>
          </div>
        </div>
        {roles.length > 1 && (
          <fieldset className="mt-5">
            <legend className="label">{t('session.activeRole')}</legend>
            <div className="grid gap-2">
              {roles.map((r) => (
                <label key={r} className={`btn cursor-pointer justify-start ${activeRole === r ? 'border-blue bg-sky' : ''}`}>
                  <input type="radio" className="sr-only" checked={activeRole === r} onChange={() => setActiveRole(r)} />
                  {t(`roles.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Section>
      <Section title="All my pages">
        <ul className="divide-y divide-line">
          {more.map((n) => (
            <li key={n.to}>
              <Link to={n.to} className="flex min-h-12 items-center justify-between font-semibold hover:text-blue">
                {t(`nav.${n.key}`)} <ChevronRight size={18} aria-hidden className="text-slate" />
              </Link>
            </li>
          ))}
          <li>
            <Link to="/staff/forgot" className="flex min-h-12 items-center justify-between font-semibold hover:text-blue">
              <span className="flex items-center gap-2"><KeyRound size={18} aria-hidden /> Change my password</span>
              <ChevronRight size={18} aria-hidden className="text-slate" />
            </Link>
          </li>
        </ul>
      </Section>
      <button className="btn-danger w-full" onClick={signout.ask}>
        <LogOut size={20} aria-hidden /> {t('action.signOut')}
      </button>
      {signout.dialog}
    </div>
  );
}

export function Alerts() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me', 'notifications'], queryFn: api.notifications.mine, refetchInterval: 20_000 });
  const read = useMutation({ mutationFn: api.notifications.markRead, onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notifications'] }) });
  const unread = q.data?.filter((n) => !n.read).length ?? 0;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Alerts" actions={unread > 0 && <button className="btn" onClick={() => read.mutate()}>Mark all as read</button>} />
      <QueryState q={q} isEmpty={(d) => !d.length} empty="You're all caught up.">
        {(rows) => (
          <ul className="space-y-2">
            {rows.map((n) => (
              <li key={n.id}>
                {n.link ? (
                  <Link to={n.link} className={`panel block p-4 hover:border-blue/50 ${n.read ? '' : 'border-l-4 border-l-blue'}`}>
                    <p className={n.read ? '' : 'font-semibold'}>{n.text}</p>
                    <p className="mt-0.5 text-sm text-slate">{dateTime(n.at)}</p>
                  </Link>
                ) : (
                  <div className={`panel p-4 ${n.read ? '' : 'border-l-4 border-l-blue'}`}>
                    <p className={n.read ? '' : 'font-semibold'}>{n.text}</p>
                    <p className="mt-0.5 text-sm text-slate">{dateTime(n.at)}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      {!q.data && !q.isPending && <Empty />}
    </div>
  );
}
