// SRS-LDY-F-05: editable templates with placeholders, channel toggles, delivery log with retries.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type NotificationTemplate } from '@ldy/api-client';
import { ErrorAlert, Field, PageHeader, Pill, QueryState, Section, Tabs, useToast } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { errorField, errorMessage } from '@/lib/errors';

export function Notifications() {
  const [tab, setTab] = useState<'templates' | 'log'>('templates');
  return (
    <div>
      <PageHeader title="Notifications" intro="SMS and email are simulated in this build. Every attempt is logged; failed sends are retried before being marked failed." />
      <Tabs tabs={[{ key: 'templates', label: 'Message templates' }, { key: 'log', label: 'Delivery log' }]} value={tab} onChange={setTab} />
      {tab === 'templates' ? <Templates /> : <Log />}
    </div>
  );
}

function Templates() {
  const q = useQuery({ queryKey: ['templates'], queryFn: api.notifications.templates });
  return <QueryState q={q}>{(rows) => <div className="space-y-4">{rows.map((t) => <TemplateEditor key={t.key} t={t} />)}</div>}</QueryState>;
}

function TemplateEditor({ t }: { t: NotificationTemplate }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState(t.body);
  const [ch, setCh] = useState(t.channels);
  const m = useMutation({ mutationFn: () => api.notifications.updateTemplate(t.key, { body, channels: ch }), onSuccess: () => { toast(`${t.name} saved. The next message uses it.`); void qc.invalidateQueries({ queryKey: ['templates'] }); } });
  return (
    <Section title={t.name} aside={t.essential ? <Pill tone="info">Always sent</Pill> : <Pill>Customers can opt out</Pill>}>
      <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <Field label="Message" hint={`Available placeholders: ${t.placeholders.map((p) => `{${p}}`).join(' ')}`} error={errorField(m.error) === 'body' ? errorMessage(m.error) : null}>
          {(p) => <textarea {...p} className="input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />}
        </Field>
        <fieldset className="flex flex-wrap gap-x-5">
          <legend className="label">Send by</legend>
          {(['inApp', 'email', 'sms'] as const).map((k) => (
            <label key={k} className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={ch[k]} onChange={(e) => setCh({ ...ch, [k]: e.target.checked })} /> {k === 'inApp' ? 'In the app' : k === 'email' ? 'Email' : 'SMS'}</label>
          ))}
        </fieldset>
        {errorField(m.error) !== 'body' && <ErrorAlert error={m.error} />}
        <button className="btn" disabled={m.isPending}>Save template</button>
      </form>
    </Section>
  );
}

function Log() {
  const { t } = useTranslation('status');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notification-log'], queryFn: api.notifications.log, refetchInterval: 20_000 });
  const retry = useMutation({ mutationFn: (id: string) => api.notifications.retry(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-log'] }) });
  const [failedOnly, setFailedOnly] = useState(false);
  return (
    <QueryState q={q} isEmpty={(d) => !d.length}>
      {(rows) => (
        <Section aside={<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} /> Failed only</label>}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Template</th><th>Channel</th><th>Recipient</th><th>Reference</th><th>Status</th><th>Tries</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.filter((r) => !failedOnly || r.status === 'FAILED').map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{dateTime(r.at)}</td>
                    <td title={r.message}>{r.template.replace(/_/g, ' ').toLowerCase()}</td>
                    <td>{r.channel === 'IN_APP' ? 'App' : r.channel === 'EMAIL' ? 'Email' : 'SMS'}</td>
                    <td>{r.recipient}</td>
                    <td>{r.reference}</td>
                    <td><Pill tone={r.status === 'SENT' ? 'good' : r.status === 'FAILED' ? 'bad' : 'info'}>{t(`notification.${r.status}`)}</Pill></td>
                    <td>{r.attempts}</td>
                    <td>{r.status === 'FAILED' && <button className="btn-link text-sm" onClick={() => retry.mutate(r.id)}>Retry</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </QueryState>
  );
}
