/**
 * Settings — SRS-LDY-F-03 (all configuration, no code deployment), E-01 (price list, express surcharge).
 * Branch Manager sees pricing and turnaround only (Appendix A note ²). Every change is audited with old/new value.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Catalogue, type ServiceType, type Settings as SettingsT } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Alert, ErrorAlert, Field, PageHeader, QueryState, Section, Tabs, useToast } from '@/components/ui';
import { errorField, errorMessage, msg } from '@/lib/errors';
import { money } from '@/lib/format';

type Tab = 'pricing' | 'turnaround' | 'services' | 'floor' | 'handover' | 'billing' | 'bookings' | 'organisation' | 'security' | 'features';

export function Settings() {
  const { can } = useAuth();
  const isAdmin = can('config.all');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'pricing', label: 'Price list' },
    { key: 'turnaround', label: 'Turnaround' },
    ...(isAdmin
      ? ([
          { key: 'services', label: 'Services and stages' },
          { key: 'floor', label: 'Floor and QC' },
          { key: 'handover', label: 'Handover' },
          { key: 'billing', label: 'Billing and receipts' },
          { key: 'bookings', label: 'Bookings' },
          { key: 'organisation', label: 'Organisation' },
          { key: 'security', label: 'Sign-in security' },
          { key: 'features', label: 'Features' },
        ] as { key: Tab; label: string }[])
      : []),
  ];
  const [tab, setTab] = useState<Tab>('pricing');
  const s = useQuery({ queryKey: ['settings', 'staff'], queryFn: api.settings.get });
  const cat = useQuery({ queryKey: ['catalogue', 'staff'], queryFn: api.catalogue.get });
  return (
    <div>
      <PageHeader title="Settings" intro="Changes apply to new orders from now on. Orders already in progress keep the rules they started with." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'pricing' && <QueryState q={cat}>{(c) => <PriceList cat={c} />}</QueryState>}
      {tab === 'services' && <QueryState q={cat}>{(c) => <Services cat={c} />}</QueryState>}
      {tab !== 'pricing' && tab !== 'services' && <QueryState q={s}>{(st) => <SettingsForm key={tab} tab={tab} s={st} />}</QueryState>}
    </div>
  );
}

// ---------------- generic number/text editors over a draft copy ----------------
function SettingsForm({ tab, s }: { tab: Tab; s: SettingsT }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<SettingsT>(structuredClone(s));
  useEffect(() => setD(structuredClone(s)), [s]);
  const keysFor: Record<string, (keyof SettingsT)[]> = {
    turnaround: ['sla', 'express'],
    floor: ['stageAlertHours', 'reworkLimit', 'qc', 'batching'],
    handover: ['handover'],
    billing: ['billing'],
    bookings: ['bookings'],
    organisation: ['organisation'],
    security: ['security'],
    features: ['features'],
  };
  const save = useMutation({
    mutationFn: () => api.settings.update(Object.fromEntries(keysFor[tab].map((k) => [k, d[k]])) as Partial<SettingsT>),
    onSuccess: (n) => {
      qc.setQueryData(['settings', 'staff'], n);
      void qc.invalidateQueries({ queryKey: ['settings'] });
      toast('Settings saved. They apply to new orders from now.');
    },
  });
  const fe = (path: string) => (errorField(save.error) === path ? errorMessage(save.error) : null);
  const num = (label: string, path: string, get: () => number, set: (v: number) => void, hint?: ReactNode) => (
    <Field label={label} error={fe(path)} hint={hint}>
      {(p) => <input {...p} className="input" inputMode="decimal" value={Number.isNaN(get()) ? '' : String(get())} onChange={(e) => { set(e.target.value === '' ? NaN : Number(e.target.value)); }} />}
    </Field>
  );
  const up = (fn: (x: SettingsT) => void) => setD((prev) => { const n = structuredClone(prev); fn(n); return n; });

  return (
    <form className="space-y-5" onSubmit={(e) => (e.preventDefault(), save.mutate())} noValidate>
      {tab === 'turnaround' && (
        <Section title="Turnaround and express">
          <div className="grid gap-4 sm:grid-cols-2">
            {num('Standard turnaround (hours)', 'sla.standardHours', () => d.sla.standardHours, (v) => up((x) => (x.sla.standardHours = v)))}
            {num('Express turnaround (hours)', 'sla.expressHours', () => d.sla.expressHours, (v) => up((x) => (x.sla.expressHours = v)))}
            <Field label="Express surcharge type">
              {(p) => <select {...p} className="input" value={d.express.surchargeType} onChange={(e) => up((x) => (x.express.surchargeType = e.target.value as 'PERCENT' | 'FIXED'))}><option value="PERCENT">Percentage of the price</option><option value="FIXED">Fixed amount per order</option></select>}
            </Field>
            {num(d.express.surchargeType === 'PERCENT' ? 'Express surcharge (%)' : 'Express surcharge (amount)', 'express.value', () => d.express.value, (v) => up((x) => (x.express.value = v)))}
          </div>
        </Section>
      )}
      {tab === 'floor' && (
        <>
          <Section title="Processing">
            <div className="grid gap-4 sm:grid-cols-2">
              {num('Stage time limit before alerting the manager (hours)', 'stageAlertHours', () => d.stageAlertHours, (v) => up((x) => (x.stageAlertHours = v)))}
              {num('Reworks allowed per item before manager review', 'reworkLimit', () => d.reworkLimit, (v) => up((x) => (x.reworkLimit = v)))}
            </div>
            <div className="mt-3 space-y-1">
              <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={d.batching.separateColours} onChange={(e) => up((x) => (x.batching.separateColours = e.target.checked))} /> Keep whites, colours and darks in separate batches</label>
              <label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={d.batching.separateDelicates} onChange={(e) => up((x) => (x.batching.separateDelicates = e.target.checked))} /> Keep delicate fabrics in separate batches</label>
            </div>
          </Section>
          <Section title="Quality check">
            <fieldset className="space-y-1">
              <legend className="label">What gets inspected</legend>
              <label className="flex min-h-10 items-center gap-2"><input type="radio" checked={d.qc.mode === 'ALL'} onChange={() => up((x) => (x.qc.mode = 'ALL'))} /> Every item</label>
              <label className="flex min-h-10 items-center gap-2"><input type="radio" checked={d.qc.mode === 'SAMPLE'} onChange={() => up((x) => (x.qc.mode = 'SAMPLE'))} /> A sample of each batch</label>
            </fieldset>
            {d.qc.mode === 'SAMPLE' && <div className="mt-2 max-w-xs">{num('Sample size (% of items per batch)', 'qc.samplePercent', () => d.qc.samplePercent, (v) => up((x) => (x.qc.samplePercent = v)))}</div>}
            <label className="mt-3 flex items-start gap-2"><input type="checkbox" className="mt-1" checked={d.qc.independent} onChange={(e) => up((x) => (x.qc.independent = e.target.checked))} /> <span>Independent QC: the attendant who finished an item's last stage can't inspect it. Small branches can leave this off.</span></label>
          </Section>
        </>
      )}
      {tab === 'handover' && (
        <Section title="Collection, reminders and delivery">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reminder days after the ready notice" hint="Comma-separated, e.g. 7, 14" error={fe('handover.reminderDays.0') ?? fe('handover.reminderDays.1')}>
              {(p) => <input {...p} className="input" value={d.handover.reminderDays.join(', ')} onChange={(e) => up((x) => (x.handover.reminderDays = e.target.value.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v))))} />}
            </Field>
            {num('Flag for manager follow-up after (days)', 'handover.managerFlagDays', () => d.handover.managerFlagDays, (v) => up((x) => (x.handover.managerFlagDays = v)))}
            {num('Unclaimed items may be disposed of after (days)', 'handover.disposalDays', () => d.handover.disposalDays, (v) => up((x) => (x.handover.disposalDays = v)))}
            {num('Orders per delivery route', 'handover.routeCapacity', () => d.handover.routeCapacity, (v) => up((x) => (x.handover.routeCapacity = v)))}
            <Field label="When customers pay" hint="Waiting on the supervisor (open question 3).">
              {(p) => <select {...p} className="input" value={d.handover.paymentPolicy} onChange={(e) => up((x) => (x.handover.paymentPolicy = e.target.value as SettingsT['handover']['paymentPolicy']))}><option value="EITHER">At drop-off, at collection, or split</option><option value="AT_DROPOFF">At drop-off</option><option value="AT_COLLECTION">At collection</option></select>}
            </Field>
          </div>
        </Section>
      )}
      {tab === 'billing' && (
        <>
          <Section title="Taxes and levies" aside={<button type="button" className="btn min-h-9 text-sm" onClick={() => up((x) => x.billing.taxes.push({ name: '', ratePercent: 0 }))}>Add a tax line</button>}>
            {!d.billing.taxes.length && <p className="muted text-sm">No taxes are configured. Rates are waiting on the supervisor (open question 4).</p>}
            {d.billing.taxes.map((t, i) => (
              <div key={i} className="mb-2 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                <Field label="Name on receipt" error={fe(`billing.taxes.${i}.name`)}>{(p) => <input {...p} className="input" value={t.name} onChange={(e) => up((x) => (x.billing.taxes[i].name = e.target.value))} />}</Field>
                {num('Rate (%)', `billing.taxes.${i}.ratePercent`, () => t.ratePercent, (v) => up((x) => (x.billing.taxes[i].ratePercent = v)))}
                <button type="button" className="btn-link text-danger" onClick={() => up((x) => x.billing.taxes.splice(i, 1))}>Remove</button>
              </div>
            ))}
          </Section>
          <Section title="Receipts, cash-up and corporate defaults">
            <Field label="Terms printed on invoices and receipts" hint="Include the liability limit for damage or loss and the unclaimed-items period.">
              {(p) => <textarea {...p} className="input" rows={3} value={d.billing.liabilityTerms} onChange={(e) => up((x) => (x.billing.liabilityTerms = e.target.value))} />}
            </Field>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {num('Cash-up tolerance per method', 'billing.cashupTolerance', () => d.billing.cashupTolerance, (v) => up((x) => (x.billing.cashupTolerance = v)))}
              {num('Default corporate credit limit', 'billing.corporateDefaultLimit', () => d.billing.corporateDefaultLimit, (v) => up((x) => (x.billing.corporateDefaultLimit = v)))}
              {num('Default corporate terms (days)', 'billing.corporateTermsDays', () => d.billing.corporateTermsDays, (v) => up((x) => (x.billing.corporateTermsDays = v)))}
            </div>
          </Section>
        </>
      )}
      {tab === 'bookings' && (
        <Section title="Online booking slots">
          <Alert>Operating hours, slot length and capacity are waiting on the supervisor (open question 1). These are placeholders.</Alert>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {num('Opening hour (0–23)', 'bookings.openHour', () => d.bookings.openHour, (v) => up((x) => (x.bookings.openHour = v)))}
            {num('Closing hour (0–23)', 'bookings.closeHour', () => d.bookings.closeHour, (v) => up((x) => (x.bookings.closeHour = v)))}
            {num('Slot length (minutes)', 'bookings.slotMinutes', () => d.bookings.slotMinutes, (v) => up((x) => (x.bookings.slotMinutes = v)))}
            {num('Bookings per slot', 'bookings.maxPerSlot', () => d.bookings.maxPerSlot, (v) => up((x) => (x.bookings.maxPerSlot = v)))}
            {num('Customer can cancel until (hours before)', 'bookings.cancelCutoffHours', () => d.bookings.cancelCutoffHours, (v) => up((x) => (x.bookings.cancelCutoffHours = v)))}
          </div>
        </Section>
      )}
      {tab === 'organisation' && (
        <Section title="Organisation details">
          <div className="grid gap-4 sm:grid-cols-2">
            {(['name', 'address', 'phone', 'tin'] as const).map((k) => (
              <Field key={k} label={{ name: 'Business name', address: 'Address', phone: 'Phone', tin: 'Tax identification number (TIN)' }[k]} error={fe(`organisation.${k}`)}>
                {(p) => <input {...p} className="input" value={d.organisation[k]} onChange={(e) => up((x) => (x.organisation[k] = e.target.value))} />}
              </Field>
            ))}
            <Field label="Currency">{(p) => <input {...p} className="input" value={d.organisation.currency} onChange={(e) => up((x) => (x.organisation.currency = e.target.value.toUpperCase()))} />}</Field>
            <Field label="Date format">{(p) => <select {...p} className="input" value={d.organisation.dateFormat} onChange={(e) => up((x) => (x.organisation.dateFormat = e.target.value))}><option value="dd/MM/yyyy">DD/MM/YYYY</option><option value="yyyy-MM-dd">YYYY-MM-DD</option></select>}</Field>
            <Field label="Time zone">{(p) => <input {...p} className="input" value={d.organisation.timeZone} onChange={(e) => up((x) => (x.organisation.timeZone = e.target.value))} />}</Field>
          </div>
        </Section>
      )}
      {tab === 'security' && (
        <Section title="Sign-in security">
          <div className="grid gap-4 sm:grid-cols-3">
            {num('Sign out after inactivity (minutes)', 'security.idleTimeoutMinutes', () => d.security.idleTimeoutMinutes, (v) => up((x) => (x.security.idleTimeoutMinutes = v)))}
            {num('Wrong passwords before locking', 'security.lockoutAttempts', () => d.security.lockoutAttempts, (v) => up((x) => (x.security.lockoutAttempts = v)))}
            {num('Lock length (minutes)', 'security.lockoutMinutes', () => d.security.lockoutMinutes, (v) => up((x) => (x.security.lockoutMinutes = v)))}
          </div>
        </Section>
      )}
      {tab === 'features' && (
        <Section title="Optional features">
          <p className="mb-3 text-sm text-slate">Optional features. Switch off what the shop does not use, to keep screens simple. Nothing is deleted; switching back on restores them.</p>
          <label className="flex min-h-12 items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={d.features.bookings} onChange={(e) => up((x) => (x.features.bookings = e.target.checked))} /> <span><strong>Online pickup and drop-off bookings</strong> (A-06). Customers book slots; the counter converts them to orders.</span></label>
          <label className="flex min-h-12 items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5" checked={d.features.corporate} onChange={(e) => up((x) => (x.features.corporate = e.target.checked))} /> <span><strong>Corporate accounts</strong> (E-04). Business customers billed monthly on credit terms.</span></label>
        </Section>
      )}
      {!errorField(save.error) && <ErrorAlert error={save.error} />}
      {errorField(save.error) && <Alert tone="error">{errorMessage(save.error)}</Alert>}
      <button className="btn-primary" disabled={save.isPending}>Save changes</button>
    </form>
  );
}

// ---------------- Price list (E-01) ----------------
function PriceList({ cat }: { cat: Catalogue }) {
  const qc = useQueryClient();
  const toast = useToast();
  const perItem = cat.serviceTypes.filter((s) => s.pricing === 'PER_ITEM');
  const perKg = cat.serviceTypes.filter((s) => s.pricing === 'PER_KG');
  const priceOf = (c: string, s: string) => cat.prices.find((p) => p.categoryId === c && p.serviceTypeId === s);
  const upsert = useMutation({ mutationFn: (p: { categoryId: string; serviceTypeId: string; price: number }) => api.catalogue.upsertPrice(p), onSuccess: (p) => { toast(`Price saved: ${money(p.price)}.`); void qc.invalidateQueries({ queryKey: ['catalogue'] }); } });
  const del = useMutation({ mutationFn: (id: string) => api.catalogue.deletePrice(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogue'] }) });
  const [newCat, setNewCat] = useState('');
  const addCat = useMutation({ mutationFn: () => api.catalogue.addCategory(newCat), onSuccess: () => { setNewCat(''); void qc.invalidateQueries({ queryKey: ['catalogue'] }); } });
  return (
    <div className="space-y-5">
      <Section title="Per-item prices">
        <p className="muted mb-3 text-sm">Empty cells are not priced: those combinations are refused at the counter, never charged at zero. Type a price and leave the cell to save it.</p>
        <ErrorAlert error={upsert.error ?? del.error} />
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Item</th>{perItem.map((s) => <th key={s.id}>{s.name}</th>)}</tr></thead>
            <tbody>
              {cat.categories.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  {perItem.map((s) => {
                    const p = priceOf(c.id, s.id);
                    return (
                      <td key={s.id}>
                        <PriceCell label={`${c.name}, ${s.name}`} value={p?.price} onSave={(v) => upsert.mutate({ categoryId: c.id, serviceTypeId: s.id, price: v })} onClear={p ? () => del.mutate(p.id) : undefined} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => (e.preventDefault(), addCat.mutate())}>
          <Field label="Add an item category">{(p) => <input {...p} className="input" value={newCat} onChange={(e) => setNewCat(e.target.value)} />}</Field>
          <button className="btn" disabled={!newCat.trim()}>Add category</button>
          <div className="w-full"><ErrorAlert error={addCat.error} /></div>
        </form>
      </Section>
      {perKg.length > 0 && (
        <Section title="Weight-based prices">
          {perKg.map((s) => {
            const p = priceOf('*', s.id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 py-1">
                <span className="w-56 font-semibold">{s.name}</span>
                <PriceCell label={`${s.name} per kg`} value={p?.price} onSave={(v) => upsert.mutate({ categoryId: '*', serviceTypeId: s.id, price: v })} />
                <span className="text-sm text-slate">per kg</span>
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}

function PriceCell({ label, value, onSave, onClear }: { label: string; value?: number; onSave: (v: number) => void; onClear?: () => void }) {
  const [v, setV] = useState(value !== undefined ? String(value) : '');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setV(value !== undefined ? String(value) : ''), [value]);
  return (
    <div className="min-w-24">
      <input
        aria-label={label}
        aria-invalid={Boolean(err)}
        className={`input min-h-9 w-24 py-1 ${value === undefined ? 'border-dashed bg-mist' : ''}`}
        inputMode="decimal"
        placeholder="Not priced"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v.trim() === '') {
            setErr(null);
            if (value !== undefined && onClear) onClear();
            return;
          }
          const n = Number(v);
          // F-03 / E-01: blank or negative values are refused; the previous value stays
          if (!(n > 0)) {
            setErr(msg('INVALID_CONFIG_VALUE'));
            setV(value !== undefined ? String(value) : '');
            return;
          }
          setErr(null);
          if (n !== value) onSave(n);
        }}
      />
      {err && <p className="field-error max-w-40 text-xs">{err}</p>}
    </div>
  );
}

// ---------------- Service types & stage sequences (B-02 config) ----------------
function Services({ cat }: { cat: Catalogue }) {
  return (
    <div className="space-y-4">
      {cat.serviceTypes.map((s) => <ServiceEditor key={s.id} s={s} />)}
      <ServiceEditor s={null} />
    </div>
  );
}

function ServiceEditor({ s }: { s: ServiceType | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(s?.name ?? '');
  const [pricing, setPricing] = useState<ServiceType['pricing']>(s?.pricing ?? 'PER_ITEM');
  const [stages, setStages] = useState((s?.stages ?? []).join(', '));
  const [active, setActive] = useState(s?.active ?? true);
  const m = useMutation({
    mutationFn: () => api.catalogue.upsertServiceType({ id: s?.id, name, pricing, stages: stages.split(',').map((x) => x.trim()).filter(Boolean), active }),
    onSuccess: () => { toast('Service saved.'); void qc.invalidateQueries({ queryKey: ['catalogue'] }); if (!s) { setName(''); setStages(''); } },
  });
  return (
    <Section title={s ? s.name : 'Add a service type'}>
      <form className="grid gap-3 sm:grid-cols-[1.5fr_1fr_2fr_auto] sm:items-end" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
        <Field label="Name">{(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Priced">{(p) => <select {...p} className="input" value={pricing} onChange={(e) => setPricing(e.target.value as ServiceType['pricing'])}><option value="PER_ITEM">Per item</option><option value="PER_KG">Per kg</option></select>}</Field>
        <Field label="Stages in order" hint="Comma-separated, e.g. Wash, Dry, Iron" error={errorField(m.error) === 'stages' ? errorMessage(m.error) : null}>{(p) => <input {...p} className="input" value={stages} onChange={(e) => setStages(e.target.value)} />}</Field>
        <button className="btn" disabled={!name.trim() || m.isPending}>{s ? 'Save' : 'Add'}</button>
        <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Offered to customers</label>
        {errorField(m.error) !== 'stages' && <div className="sm:col-span-4"><ErrorAlert error={m.error} /></div>}
      </form>
    </Section>
  );
}
