// SRS-LDY-B-03 machine register: Available / In Use / Under Maintenance; utilisation for F-01.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, type Machine } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { ErrorAlert, Field, PageHeader, Pill, QueryState, Section } from '@/components/ui';
import { Link } from 'react-router-dom';

export function Machines() {
  const { can } = useAuth();
  const { t } = useTranslation('status');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['machines'], queryFn: api.machines.list, refetchInterval: 20_000 });
  const set = useMutation({ mutationFn: ({ id, status }: { id: string; status: Machine['status'] }) => api.machines.setStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['machines'] }) });
  const tone = (s: Machine['status']) => (s === 'AVAILABLE' ? 'good' : s === 'IN_USE' ? 'info' : 'bad');
  return (
    <div>
      <PageHeader title="Machines and stations" intro="A machine running a load can't take a second one until that load finishes." />
      {can('config.all') && <AddMachine />}
      <QueryState q={q}>
        {(ms) => (
          <Section className="mt-5">
            <ErrorAlert error={set.error} />
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Time in use</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {ms.map((m) => (
                    <tr key={m.id}>
                      <td className="font-semibold">{m.name}</td>
                      <td>{m.type.toLowerCase()}</td>
                      <td>
                        <Pill tone={tone(m.status)}>{t(`machine.${m.status}`)}</Pill>
                        {m.currentBatchId && <Link to={`/staff/batches/${m.currentBatchId}`} className="btn-link ml-2 text-sm">batch</Link>}
                      </td>
                      <td>{Math.round(m.minutesInUse / 60)} h</td>
                      <td>
                        {can('machine.maintenance') && m.status === 'AVAILABLE' && <button className="btn min-h-9 text-sm" onClick={() => set.mutate({ id: m.id, status: 'UNDER_MAINTENANCE' })}>Mark under maintenance</button>}
                        {can('machine.maintenance') && m.status === 'UNDER_MAINTENANCE' && <button className="btn min-h-9 text-sm" onClick={() => set.mutate({ id: m.id, status: 'AVAILABLE' })}>Return to service</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </QueryState>
    </div>
  );
}

function AddMachine() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<Machine['type']>('WASHER');
  const m = useMutation({ mutationFn: () => api.machines.create({ name, type }), onSuccess: () => { setName(''); void qc.invalidateQueries({ queryKey: ['machines'] }); } });
  return (
    <form className="panel grid gap-3 p-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
      <Field label="New machine name">{(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="Type">{(p) => <select {...p} className="input" value={type} onChange={(e) => setType(e.target.value as Machine['type'])}><option value="WASHER">Washer</option><option value="DRYER">Dryer</option><option value="PRESS">Press</option><option value="STATION">Station</option></select>}</Field>
      <button className="btn-primary" disabled={!name.trim() || m.isPending}>Add machine</button>
      <div className="sm:col-span-3"><ErrorAlert error={m.error} /></div>
    </form>
  );
}
