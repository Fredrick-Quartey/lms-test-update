/**
 * Counter — Front Desk Officer, Branch Manager.
 * SRS-LDY-A-01 (find/add/guest), A-02 (itemise, ready-by, finalise), A-03 (tags), A-04 (condition flags),
 * E-01 (auto pricing, express, no zero price), E-02 (invoice, payment, receipt), E-04 (corporate on account).
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Customer, type FlagType, type Order } from '@ldy/api-client';
import { Alert, Avatar, ErrorAlert, Field, KeyValue, Modal, PageHeader, PaymentBadge, Popover, QueryState, Section, Segmented, StatusBadge, Ticket, useToast } from '@/components/ui';
import { Info, Search, UserPlus, UserRound } from 'lucide-react';
import { FLAG_LABEL, InvoiceTable, ItemsTable } from '@/components/order';
import { PaymentPanel } from '@/components/PaymentPanel';
import { PhotoInput } from '@/components/inputs';
import { useCatalogue, useSettings } from '@/config/settings';
import { errorCode, errorField, errorMessage, msg } from '@/lib/errors';
import { date, dateTime, maskPhone, money } from '@/lib/format';
import { useAuth } from '@/auth/session';
import { PHONE_RE, cleanPhone } from '@/lib/validation';

export function Counter() {
  const { orderId } = useParams();
  if (!orderId) return <CustomerStep />;
  return <OrderStep orderId={orderId} />;
}

// ---------------- Step 1: find, add or serve a guest (A-01). Add and Guest open as pop-ups (D17). ----------------
function CustomerStep() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [modal, setModal] = useState<null | 'add' | 'guest'>(null);
  const results = useQuery({ queryKey: ['customers', term], queryFn: () => api.customers.search(term), enabled: term.length > 0 });
  const start = useMutation({
    mutationFn: (d: { customerId?: string; guest?: { name?: string; phone: string } }) => api.orders.createDraft(d),
    onSuccess: (o) => nav(`/staff/counter/${o.id}`),
  });
  const drafts = useQuery({ queryKey: ['orders', 'drafts'], queryFn: () => api.orders.list({ status: 'DRAFT', pageSize: 10 }) });
  const typedPhone = PHONE_RE.test(cleanPhone(q)) ? cleanPhone(q) : '';

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader back={{ to: '/staff/overview', label: 'Overview' }} title="New order" intro="Find the customer by phone number first, so their details and preferences are reused." />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Section>
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTerm(q.trim());
            }}
          >
            <label htmlFor="cust-search" className="sr-only">Phone number or name</label>
            <div className="relative flex-1">
              <Search size={20} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
              <input id="cust-search" autoFocus className="input pl-11 text-lg" inputMode="tel" placeholder="Phone number, e.g. 0244123456" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button className="btn-primary shrink-0" disabled={!q.trim()}>Search</button>
          </form>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => setModal('add')}><UserPlus size={18} aria-hidden /> Add customer</button>
            <button className="btn" onClick={() => setModal('guest')}><UserRound size={18} aria-hidden /> Serve as guest</button>
          </div>

          {term && (
            <div className="mt-5">
              {results.isPending && <p className="muted">Searching…</p>}
              {results.data && results.data.length === 0 && (
                <Alert>
                  No customer matches “{term}”.{' '}
                  <button className="btn-link" onClick={() => setModal('add')}>Add them</button> or{' '}
                  <button className="btn-link" onClick={() => setModal('guest')}>serve as a guest</button>.
                </Alert>
              )}
              <ul className="space-y-2">
                {results.data?.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-[14px] border border-line p-3">
                    <Avatar name={c.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{c.name}</span>
                        <CustomerInfo c={c} />
                      </p>
                      <p className="text-sm text-slate">{maskPhone(c.phone)}{c.accountType === 'CORPORATE' ? ', corporate account' : ''}</p>
                    </div>
                    <button className="btn-primary shrink-0" onClick={() => start.mutate({ customerId: c.id })} disabled={start.isPending}>Start order</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-3"><ErrorAlert error={start.error} /></div>
        </Section>
        <Section title="Unfinished drafts">
          {!drafts.data?.items.length && <p className="muted text-sm">No draft orders waiting.</p>}
          <ul className="divide-y divide-line">
            {drafts.data?.items.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span><Ticket>{o.orderNo}</Ticket> {o.customerName}, {o.items.length} item(s)</span>
                <Link className="btn-link" to={`/staff/counter/${o.id}`}>Continue</Link>
              </li>
            ))}
          </ul>
          <p className="muted mt-3 text-sm">Online bookings become orders from <Link to="/staff/bookings" className="btn-link">Bookings</Link> when the laundry arrives.</p>
        </Section>
      </div>
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Add a customer">
        <AddCustomer initialPhone={typedPhone} onCreated={(c) => { setModal(null); start.mutate({ customerId: c.id }); }} onUseExisting={(phone) => { setModal(null); setQ(phone); setTerm(phone); }} />
      </Modal>
      <Modal open={modal === 'guest'} onClose={() => setModal(null)} title="Serve a walk-in guest">
        <GuestForm initialPhone={typedPhone} busy={start.isPending} onStart={(g) => { setModal(null); start.mutate({ guest: g }); }} />
      </Modal>
    </div>
  );
}

/** D18: an info icon opens the customer's existing details (no free-text notes field: OQ18). */
function CustomerInfo({ c }: { c: Customer }) {
  return (
    <Popover
      align="left"
      width="w-72"
      trigger={({ toggle, ...a }) => (
        <button {...a} type="button" onClick={toggle} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate hover:bg-mist hover:text-blue" aria-label={`Details for ${c.name}`}>
          <Info size={18} aria-hidden />
        </button>
      )}
    >
      {() => (
        <div className="p-2 text-sm">
          <p className="mb-2 font-bold">{c.name}</p>
          <KeyValue rows={[
            ['Phone', c.phone],
            ['Email', c.email ?? '—'],
            ['Address', c.address ?? '—'],
            ['Prefers', prefText(c)],
            ['Account', c.accountType === 'CORPORATE' ? `Corporate, limit ${money(c.corporate?.creditLimit)}` : 'Individual'],
            ['Since', date(c.createdAt)],
          ]} />
        </div>
      )}
    </Popover>
  );
}

function prefText(c: Customer) {
  const p = c.preferences;
  return [p.starch ? 'Starch' : 'No starch', p.softener ? 'softener' : 'no softener', p.finish === 'HANGER' ? 'on hangers' : 'folded'].join(', ');
}

function AddCustomer({ initialPhone, onCreated, onUseExisting }: { initialPhone: string; onCreated: (c: Customer) => void; onUseExisting: (phone: string) => void }) {
  const { activeRole } = useAuth();
  const [f, setF] = useState({ name: '', phone: initialPhone, email: '', address: '', starch: false, softener: true, finish: 'HANGER' as 'HANGER' | 'FOLD', corporate: false });
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: () => api.customers.create({ name: f.name, phone: cleanPhone(f.phone), email: f.email || undefined, address: f.address || undefined, preferences: { starch: f.starch, softener: f.softener, finish: f.finish }, accountType: f.corporate ? 'CORPORATE' : 'INDIVIDUAL' }),
    onSuccess: onCreated,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = 'Enter the customer’s name.';
    // A-01 validation rule: no profile without a valid phone number format
    if (!PHONE_RE.test(cleanPhone(f.phone))) errs.phone = msg('INVALID_PHONE');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) errs.email = msg('INVALID_EMAIL');
    setClientErr(errs);
    if (!Object.keys(errs).length) m.mutate();
  };
  const serverErr = (fld: string) => (errorField(m.error) === fld ? errorMessage(m.error) : null);
  const dup = errorCode(m.error) === 'DUPLICATE_PHONE';
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={clientErr.name ?? serverErr('name')} required>{(p) => <input {...p} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}</Field>
        <Field label="Phone number" error={clientErr.phone ?? serverErr('phone')} required>{(p) => <input {...p} className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
        <Field label="Email (optional)" error={clientErr.email ?? serverErr('email')}>{(p) => <input {...p} className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Delivery address">{(p) => <input {...p} className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />}</Field>
      </div>
      <fieldset className="flex flex-wrap gap-x-5 text-sm">
        <legend className="label">Standing preferences</legend>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={f.starch} onChange={(e) => setF({ ...f, starch: e.target.checked })} /> Starch</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={f.softener} onChange={(e) => setF({ ...f, softener: e.target.checked })} /> Softener</label>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" checked={f.finish === 'HANGER'} onChange={() => setF({ ...f, finish: 'HANGER' })} /> Hanger</label>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" checked={f.finish === 'FOLD'} onChange={() => setF({ ...f, finish: 'FOLD' })} /> Fold</label>
      </fieldset>
      {activeRole === 'MANAGER' && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.corporate} onChange={(e) => setF({ ...f, corporate: e.target.checked })} /> Corporate account (monthly billing, default limit from settings)</label>
      )}
      {dup && (
        <Alert tone="error">
          {errorMessage(m.error)} <button type="button" className="btn-link" onClick={() => onUseExisting(cleanPhone(f.phone))}>Use the existing profile</button>
        </Alert>
      )}
      {!dup && !errorField(m.error) && <ErrorAlert error={m.error} />}
      <button className="btn-primary" disabled={m.isPending}>Save and start order</button>
    </form>
  );
}

function GuestForm({ initialPhone, onStart, busy }: { initialPhone: string; onStart: (g: { name?: string; phone: string }) => void; busy: boolean }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(initialPhone);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // A-01: a guest has no saved profile, but a phone number is still required for status notifications
        if (!PHONE_RE.test(cleanPhone(phone))) return setErr(msg('INVALID_PHONE'));
        setErr(null);
        onStart({ name: name.trim() || undefined, phone: cleanPhone(phone) });
      }}
    >
      <p className="muted text-sm">No profile is saved. The phone number is used only for this order’s updates.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name (optional)">{(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Phone number" error={err} required>{(p) => <input {...p} className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      </div>
      <button className="btn-primary" disabled={busy}>Start guest order</button>
    </form>
  );
}

// ---------------- Step 2: itemise (draft) or pay + tags (finalised) ----------------
function OrderStep({ orderId }: { orderId: string }) {
  const q = useQuery({ queryKey: ['order', orderId], queryFn: () => api.orders.get(orderId) });
  return <QueryState q={q}>{(o) => (o.status === 'DRAFT' ? <DraftOrder order={o} /> : <FinalisedOrder order={o} />)}</QueryState>;
}

function DraftOrder({ order }: { order: Order }) {
  const qc = useQueryClient();
  const settings = useSettings();
  const customer = useQuery({ queryKey: ['customer', order.customerId], queryFn: () => api.customers.get(order.customerId!), enabled: Boolean(order.customerId) });
  const set = (o: Order) => qc.setQueryData(['order', o.id], o);
  const upd = useMutation({ mutationFn: (d: Parameters<typeof api.orders.updateDraft>[1]) => api.orders.updateDraft(order.id, d), onSuccess: set });
  const remove = useMutation({ mutationFn: (itemId: string) => api.orders.removeItem(order.id, itemId), onSuccess: set });
  const toast = useToast();
  const finalise = useMutation({
    mutationFn: () => api.orders.finalise(order.id),
    onSuccess: (o) => {
      set(o);
      toast(`Order ${o.orderNo} confirmed: ${o.items.length} tag${o.items.length === 1 ? '' : 's'} (${o.items.map((i) => i.tag).join(', ')}), invoice ${o.invoice?.number}.`);
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const [overrideReason, setOverrideReason] = useState('');
  const override = useMutation({ mutationFn: () => api.orders.requestCreditOverride(order.id, overrideReason), onSuccess: () => qc.invalidateQueries({ queryKey: ['order', order.id] }) });
  const s = settings.data;
  const readyBy = s ? new Date(Date.now() + (order.speed === 'EXPRESS' ? s.sla.expressHours : s.sla.standardHours) * 3600_000).toISOString() : undefined;
  const c = customer.data;
  const creditBlocked = errorCode(finalise.error) === 'CREDIT_LIMIT_EXCEEDED';

  return (
    <div className="mx-auto max-w-6xl pb-24 lg:pb-0">
      <PageHeader
        back={{ to: '/staff/counter', label: 'New order' }}
        title={`New order ${order.orderNo}`}
        intro={<>For <strong>{order.customerName}</strong>, {maskPhone(order.customerPhone)}{order.guest ? ' (guest)' : ''}{c ? `. Prefers: ${prefText(c).toLowerCase()}` : ''}</>}
        actions={<StatusBadge status={order.status} />}
      />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <AddItemForm order={order} onAdded={set} />
          <Section title={`Items (${order.items.length})`}>
            {order.items.length ? (
              <ItemsTable
                order={order}
                showStatus={false}
                extra={(id) => (
                  <button className="btn-link text-sm text-danger" onClick={() => remove.mutate(id)}>Remove</button>
                )}
              />
            ) : (
              <p className="muted text-sm">Add each piece, or each bundle of identical pieces. Every line gets its own tag when you confirm the order.</p>
            )}
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Turnaround and handover">
            <Segmented
              label="Service speed"
              value={order.speed}
              onChange={(sp) => upd.mutate({ speed: sp })}
              options={[
                { value: 'STANDARD', label: `Standard, ${s?.sla.standardHours ?? 48} h` },
                { value: 'EXPRESS', label: `Express, ${s?.sla.expressHours ?? 24} h${s ? `, +${s.express.surchargeType === 'PERCENT' ? `${s.express.value}%` : money(s.express.value)}` : ''}` },
              ]}
            />
            <label className="mt-4 flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={order.deliveryFlag} onChange={(e) => upd.mutate({ deliveryFlag: e.target.checked, deliveryAddress: order.deliveryAddress ?? c?.address })} />
              Deliver to the customer
            </label>
            {order.deliveryFlag && (
              <DeliveryAddress order={order} onSave={(a) => upd.mutate({ deliveryAddress: a })} />
            )}
            {c?.accountType === 'CORPORATE' && (
              <label className="mt-2 flex min-h-11 items-center gap-2">
                <input type="checkbox" checked={order.onAccount} onChange={(e) => upd.mutate({ onAccount: e.target.checked })} />
                Bill to corporate account (balance {money(c.corporate?.runningBalance)} of {money(c.corporate?.creditLimit)} limit)
              </label>
            )}
            <p className="mt-3 text-sm">Expected ready by <strong>{dateTime(readyBy)}</strong> if confirmed now.</p>
            <ErrorAlert error={upd.error ?? remove.error} />
          </Section>
          <Section title="Invoice preview">
            <InvoiceTable invoice={order.invoice} />
          </Section>
          <div className="space-y-3">
            {creditBlocked ? (
              <Alert tone="error" title="Credit limit">
                <p>{errorMessage(finalise.error)}</p>
                {order.creditOverride === 'PENDING' || override.isSuccess ? (
                  <p className="mt-2 font-semibold">Override requested. A Branch Manager (not you) must approve it before you confirm again.</p>
                ) : order.creditOverride === 'APPROVED' ? (
                  <p className="mt-2 font-semibold">Override approved. Confirm the order again.</p>
                ) : (
                  <form className="mt-2 space-y-2" onSubmit={(e) => (e.preventDefault(), override.mutate())}>
                    <Field label="Reason for the override" required>{(p) => <input {...p} className="input" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />}</Field>
                    <button className="btn" disabled={!overrideReason.trim() || override.isPending}>Request Branch Manager override</button>
                    <ErrorAlert error={override.error} />
                  </form>
                )}
              </Alert>
            ) : (
              <ErrorAlert error={finalise.error} />
            )}
            {/* A-02: one action assigns tags, ready-by and invoice (NFR-P1 ≤ 2 s) */}
            <button className="btn-primary hidden w-full min-h-14 text-lg lg:flex" onClick={() => finalise.mutate()} disabled={finalise.isPending}>
              {finalise.isPending ? 'Confirming…' : `Confirm order, ${money(order.invoice?.total ?? 0)}`}
            </button>
            <p className="muted text-sm">After confirming, items and prices can't be changed. Tags and the invoice are made in the same step.</p>
            {/* Phones: sticky total bar (REDESIGN §10) */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate">Total, {order.items.length} line{order.items.length === 1 ? '' : 's'}</p>
                <p className="tabular text-lg font-bold">{money(order.invoice?.total ?? 0)}</p>
              </div>
              <button className="btn-primary min-h-12" onClick={() => finalise.mutate()} disabled={finalise.isPending}>{finalise.isPending ? 'Confirming…' : 'Confirm order'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryAddress({ order, onSave }: { order: Order; onSave: (a: string) => void }) {
  const [a, setA] = useState(order.deliveryAddress ?? '');
  return (
    <Field label="Delivery address" required>
      {(p) => <textarea {...p} rows={2} className="input" value={a} onChange={(e) => setA(e.target.value)} onBlur={() => a !== order.deliveryAddress && onSave(a)} />}
    </Field>
  );
}

const FLAG_TYPES: FlagType[] = ['STAIN', 'DAMAGE', 'DELICATE', 'NO_STARCH', 'COLOUR_RUN_RISK', 'OTHER'];

function AddItemForm({ order, onAdded }: { order: Order; onAdded: (o: Order) => void }) {
  const cat = useCatalogue();
  const empty = { serviceTypeId: '', categoryId: '', quantity: '1', weightKg: '', colour: 'COLOURS' as const, fabric: 'REGULAR' as const, instructions: '' };
  const [f, setF] = useState<{ serviceTypeId: string; categoryId: string; quantity: string; weightKg: string; colour: 'WHITES' | 'COLOURS' | 'DARKS'; fabric: 'REGULAR' | 'DELICATE'; instructions: string }>(empty);
  const [flags, setFlags] = useState<{ type: FlagType; note: string; photo: string | null }[]>([]);
  const st = cat.data?.serviceTypes.find((s) => s.id === f.serviceTypeId);
  const price = useMemo(() => {
    if (!cat.data || !st) return undefined;
    const key = st.pricing === 'PER_KG' ? '*' : f.categoryId;
    return cat.data.prices.find((p) => p.serviceTypeId === st.id && p.categoryId === key)?.price ?? null;
  }, [cat.data, st, f.categoryId]);
  const add = useMutation({
    mutationFn: () =>
      api.orders.addItem(order.id, {
        serviceTypeId: f.serviceTypeId,
        categoryId: st?.pricing === 'PER_KG' ? f.categoryId || '*' : f.categoryId,
        quantity: Number(f.quantity),
        weightKg: st?.pricing === 'PER_KG' ? Number(f.weightKg) : undefined,
        colour: f.colour,
        fabric: f.fabric,
        instructions: f.instructions,
        flags: flags.map((x) => ({ type: x.type, note: x.note || undefined, photo: x.photo || undefined })),
      }),
    onSuccess: (o) => {
      onAdded(o);
      setF({ ...empty, serviceTypeId: f.serviceTypeId });
      setFlags([]);
    },
  });
  const damageMissing = flags.some((x) => x.type === 'DAMAGE' && !x.note.trim() && !x.photo);
  const noPrice = price === null && Boolean(st) && (st?.pricing === 'PER_KG' || Boolean(f.categoryId));
  return (
    <Section title="Add an item">
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), add.mutate())} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service type" required error={errorField(add.error) === 'serviceTypeId' ? errorMessage(add.error) : null}>
            {(p) => (
              <select {...p} className="input" value={f.serviceTypeId} onChange={(e) => setF({ ...f, serviceTypeId: e.target.value })}>
                <option value="">Choose…</option>
                {cat.data?.serviceTypes.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </Field>
          {st?.pricing !== 'PER_KG' ? (
            <Field label="Item" required>
              {(p) => (
                <select {...p} className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                  <option value="">Choose…</option>
                  {cat.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </Field>
          ) : (
            <Field label="Weight (kg)" required error={errorField(add.error) === 'weightKg' ? errorMessage(add.error) : null}>
              {(p) => <input {...p} className="input" inputMode="decimal" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} />}
            </Field>
          )}
          {st?.pricing !== 'PER_KG' && (
            <Field label="Quantity" hint="Identical pieces share one bundle tag." error={errorField(add.error) === 'quantity' ? errorMessage(add.error) : null}>
              {(p) => <input {...p} className="input" type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Colour group">
              {(p) => (
                <select {...p} className="input" value={f.colour} onChange={(e) => setF({ ...f, colour: e.target.value as typeof f.colour })}>
                  <option value="WHITES">Whites</option>
                  <option value="COLOURS">Colours</option>
                  <option value="DARKS">Darks</option>
                </select>
              )}
            </Field>
            <Field label="Fabric">
              {(p) => (
                <select {...p} className="input" value={f.fabric} onChange={(e) => setF({ ...f, fabric: e.target.value as typeof f.fabric })}>
                  <option value="REGULAR">Regular</option>
                  <option value="DELICATE">Delicate</option>
                </select>
              )}
            </Field>
          </div>
        </div>
        <Field label="Special instructions">{(p) => <input {...p} className="input" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} placeholder="e.g. no starch on collar, crease trousers" />}</Field>

        <fieldset className="rounded-[12px] border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Condition at intake</legend>
          <p className="hint mb-2">Record stains or damage now so they are not blamed on processing later.</p>
          {flags.map((fl, i) => (
            <div key={i} className="mb-3 grid gap-3 border-b border-line pb-3 sm:grid-cols-[10rem_1fr]">
              <p className="pt-2 font-semibold">{FLAG_LABEL[fl.type]}</p>
              <div className="space-y-2">
                <Field label="Note" error={fl.type === 'DAMAGE' && !fl.note.trim() && !fl.photo ? msg('MISSING_DAMAGE_NOTE') : null}>
                  {(p) => <input {...p} className="input" value={fl.note} onChange={(e) => setFlags(flags.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />}
                </Field>
                {(fl.type === 'STAIN' || fl.type === 'DAMAGE') && (
                  <PhotoInput id={`flag-photo-${i}`} label="Photo (optional)" value={fl.photo} onChange={(ph) => setFlags(flags.map((x, j) => (j === i ? { ...x, photo: ph } : x)))} />
                )}
                <button type="button" className="btn-link text-sm text-danger" onClick={() => setFlags(flags.filter((_, j) => j !== i))}>Remove flag</button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {FLAG_TYPES.map((t) => (
              <button key={t} type="button" className="btn min-h-9 px-3 text-sm" onClick={() => setFlags([...flags, { type: t, note: '', photo: null }])}>
                {FLAG_LABEL[t]}
              </button>
            ))}
          </div>
        </fieldset>

        {noPrice && <Alert tone="error">{msg('NO_PRICE_CONFIGURED')}</Alert>}
        {!errorField(add.error) && <ErrorAlert error={add.error} />}
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={add.isPending || !f.serviceTypeId || (st?.pricing !== 'PER_KG' && !f.categoryId) || damageMissing || noPrice}>Add to order</button>
          {typeof price === 'number' && <span className="text-sm text-slate">{money(price)} {st?.pricing === 'PER_KG' ? 'per kg' : 'each'}</span>}
        </div>
      </form>
    </Section>
  );
}

function FinalisedOrder({ order }: { order: Order }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const reprint = useMutation({ mutationFn: (tag: string) => api.tags.reprint(tag), onSuccess: (r) => toast(`Tag ${r.tag} sent to the printer again. Same number.`) });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Order ${order.orderNo} received`}
        intro={<>Expected ready by <strong>{dateTime(order.expectedReadyBy)}</strong>. Attach each tag to its item before it leaves the counter.</>}
        actions={<><StatusBadge status={order.status} /><PaymentBadge state={order.paymentState} balance={order.balance} /></>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Section title="Tags" aside={<a className="btn" href={`/print/tags/${order.id}`} target="_blank">Print all tags</a>}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-[12px] border border-line px-3 py-2">
                  <Ticket>{i.tag}</Ticket>
                  <button className="btn-link text-sm" onClick={() => reprint.mutate(i.tag!)}>Reprint</button>
                </li>
              ))}
            </ul>
          </Section>
          <Section title={`Invoice ${order.invoice?.number}`} aside={<a className="btn-link text-sm" href={`/print/invoice/${order.id}`} target="_blank">Print invoice</a>}>
            <InvoiceTable invoice={order.invoice} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Payment">
            <PaymentPanel order={order} onPaid={() => void qc.invalidateQueries({ queryKey: ['order', order.id] })} />
          </Section>
          <Section>
            <KeyValue rows={[
              ['Customer', order.customerName],
              ['Handover', order.deliveryFlag ? `Delivery to ${order.deliveryAddress}` : 'Collect at the counter'],
              ['Speed', order.speed === 'EXPRESS' ? 'Express' : 'Standard'],
            ]} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn" onClick={() => nav('/staff/counter')}>Serve the next customer</button>
              <Link className="btn" to={`/staff/orders/${order.id}`}>Open order record</Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
