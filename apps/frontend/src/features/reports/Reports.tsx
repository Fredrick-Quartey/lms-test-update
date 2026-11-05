// SRS-LDY-F-01 (SHOULD): role-scoped dashboards with date filter and CSV export; figures refresh automatically.
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { ErrorAlert, EyeToggle, MoneyVisibility, PageHeader, QueryState, Section, Stat, useMoneyVisible } from '@/components/ui';
import { downloadText, money, todayISO } from '@/lib/format';

// Single-series charts: one validated hue (dataviz validator: lightness, chroma and contrast pass on white).
const MARK = '#007C99';
const AXIS = { fontSize: 12, fill: '#3e5a63' };

const EXPORTS: { type: string; label: string; roles?: string[] }[] = [
  { type: 'revenue', label: 'Payments and refunds' },
  { type: 'accounting', label: 'Accounting export (sales, refunds, cash-up)' },
  { type: 'orders', label: 'Orders and turnaround' },
  { type: 'machines', label: 'Machine utilisation', roles: ['MANAGER', 'AUDITOR'] },
  { type: 'damage', label: 'Damage and loss', roles: ['MANAGER', 'AUDITOR'] },
];

export function Reports() {
  const { activeRole } = useAuth();
  const isFrontDesk = activeRole === 'FRONT_DESK';
  const [from, setFrom] = useState(todayISO(isFrontDesk ? 0 : -29));
  const [to, setTo] = useState(todayISO());
  const q = useQuery({ queryKey: ['dashboard', from, to], queryFn: () => api.reports.dashboard(from, to), refetchInterval: 30_000 });
  const exp = useMutation({ mutationFn: (type: string) => api.reports.export(type, from, to), onSuccess: (r) => downloadText(r.filename, r.csv) });
  return (
    <MoneyVisibility>
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title={isFrontDesk ? 'Today at the counter' : 'Reports'}
        intro="Figures update on their own as orders move. Amounts stay hidden until you choose to show them. Exports are logged with your name."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <EyeToggle />
            <label className="text-sm"><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-sm"><span className="label">To</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        }
      />
      <QueryState q={q}>
        {(d) => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Revenue received" value={money(d.revenue)} note={d.refunds ? `${money(d.refunds)} refunded` : 'No refunds'} hideable />
              <Stat label="Orders received" value={d.ordersReceived} note={`${d.intakeToday} today`} />
              <Stat label="Orders handed over" value={d.ordersCompleted} />
              {!isFrontDesk && <Stat label="Average turnaround" value={d.avgTurnaroundHours !== null ? `${d.avgTurnaroundHours} h` : '—'} note={d.onTimeRate !== null ? `${d.onTimeRate}% ready on time` : undefined} />}
              {isFrontDesk && <Stat label="Cash taken" value={money(d.paymentsByMethod.CASH)} note={`MoMo ${money(d.paymentsByMethod.MOMO)}, card ${money(d.paymentsByMethod.CARD)}`} hideable />}
            </div>
            {!isFrontDesk && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Delivery success" value={d.deliverySuccessRate !== null ? `${d.deliverySuccessRate}%` : '—'} />
                <Stat label="Damage reports" value={`${d.damageRate}%`} note="of item lines received" />
                <Stat label="Mobile money" value={money(d.paymentsByMethod.MOMO)} hideable />
                <Stat label="Card" value={money(d.paymentsByMethod.CARD)} note={`Cash ${money(d.paymentsByMethod.CASH)}`} hideable />
              </div>
            )}
            {!isFrontDesk && d.stageAverages.length > 0 && (
              <Section title="Average time per stage">
                <p className="mb-3 text-sm text-slate">From the attendants' Start and Finish taps. Waiting between machines is not counted.</p>
                <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {d.stageAverages.map((x) => (
                    <li key={x.stage} className="rounded-[12px] bg-mist p-3">
                      <p className="text-sm text-slate">{x.stage}</p>
                      <p className="tabular text-xl font-bold">{x.minutes < 60 ? `${x.minutes} min` : `${Math.floor(x.minutes / 60)} h ${x.minutes % 60} min`}</p>
                      <p className="text-xs text-slate">{x.count} load{x.count === 1 ? '' : 's'}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            <Section title="Revenue received per day">
              <MoneyCharts>
              <ChartFrame label={`Revenue per day from ${from} to ${to}`}>
                <BarChart data={d.revenueByDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e5eaf3" />
                  <XAxis dataKey="date" tick={AXIS} tickFormatter={(v: string) => v.slice(8)} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS} width={56} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(18,49,59,0.05)' }} formatter={(v: number) => [money(v), 'Revenue']} labelFormatter={(l: string) => l} />
                  <Bar isAnimationActive={false} dataKey="revenue" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartFrame>
              </MoneyCharts>
            </Section>
            {!isFrontDesk && (
              <div className="grid gap-5 lg:grid-cols-2">
                <Section title="Revenue by service (items received)">
                  <MoneyCharts>
                  <ChartFrame label="Revenue by service type">
                    <BarChart data={d.revenueByService} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} stroke="#e5eaf3" />
                      <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="service" tick={AXIS} width={130} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(18,49,59,0.05)' }} formatter={(v: number) => [money(v), 'Revenue']} />
                      <Bar isAnimationActive={false} dataKey="revenue" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ChartFrame>
                  </MoneyCharts>
                </Section>
                <Section title="Machine utilisation">
                  <ChartFrame label="Machine utilisation percent">
                    <BarChart data={d.machineUtilisation} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid horizontal={false} stroke="#e5eaf3" />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={AXIS} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="machine" tick={AXIS} width={120} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(18,49,59,0.05)' }} formatter={(v: number) => [`${v}%`, 'In use']} />
                      <Bar isAnimationActive={false} dataKey="percent" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ChartFrame>
                  <p className="hint">Time in use against ten operating hours a day.</p>
                </Section>
              </div>
            )}
            <Section title="Download data">
              <ul className="flex flex-wrap gap-2">
                {EXPORTS.filter((e) => !e.roles || (activeRole && e.roles.includes(activeRole))).map((e) => (
                  <li key={e.type}><button className="btn" onClick={() => exp.mutate(e.type)} disabled={exp.isPending}>{e.label}</button></li>
                ))}
              </ul>
              <div className="mt-2"><ErrorAlert error={exp.error} /></div>
              {exp.isError && <button className="btn mt-2" onClick={() => exp.mutate(exp.variables!)}>Try the export again</button>}
            </Section>
          </div>
        )}
      </QueryState>
    </div>
    </MoneyVisibility>
  );
}

/** Revenue charts follow the same hide/show choice as the numbers. */
function MoneyCharts({ children }: { children: React.ReactNode }) {
  const { visible, toggle } = useMoneyVisible();
  if (visible) return <>{children}</>;
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-[12px] bg-mist text-sm text-slate">
      Amounts are hidden.
      <button className="btn min-h-10 text-sm" onClick={toggle}>Show amounts</button>
    </div>
  );
}

function ChartFrame({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <figure aria-label={label} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </figure>
  );
}
