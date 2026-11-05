/**
 * Pack (C-03): shelf first, then scan each item. A big progress bar names what's missing.
 * When the last item is checked the order is Packaged and the customer is told exactly once (D-01).
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api, type Order } from '@ldy/api-client';
import { Alert, BigActionButton, ErrorAlert, Field, PageHeader, QueryState, Section, Ticket, useToast } from '@/components/ui';
import { ScanInput } from '@/components/inputs';
import { useNames } from '@/config/settings';

export function Pack() {
  const { orderId } = useParams();
  const q = useQuery({ queryKey: ['pack', orderId], queryFn: () => api.packing.manifest(orderId!) });
  return <QueryState q={q}>{(o) => <PackOrder o={o} />}</QueryState>;
}

function PackOrder({ o: initial }: { o: Order }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const names = useNames();
  const [o, setO] = useState(initial);
  const [shelf, setShelf] = useState(initial.shelf ?? '');
  const [shelfSet, setShelfSet] = useState(Boolean(initial.shelf));
  const active = o.items.filter((i) => i.status !== 'DISCARDED' && i.status !== 'CANCELLED');
  const checked = active.filter((i) => i.checkedOff).length;
  const packed = o.status === 'READY_FOR_PICKUP' || (o.status === 'PACKAGED' && Boolean(o.shelf));
  const finishMsg = (r: Order) => `${r.orderNo} packed on shelf ${r.shelf}. ${r.deliveryFlag ? 'Ready for delivery.' : 'Customer notified.'}`;
  const check = useMutation({
    mutationFn: (tag: string) => api.packing.check(o.id, tag, shelf.trim()),
    onSuccess: (r) => {
      setO(r);
      void qc.invalidateQueries({ queryKey: ['floor'] });
      if (r.status === 'READY_FOR_PICKUP' || (r.status === 'PACKAGED' && r.shelf)) toast(finishMsg(r));
    },
  });
  const finalise = useMutation({ mutationFn: () => api.packing.finalise(o.id, shelf.trim()), onSuccess: (r) => { setO(r); toast(finishMsg(r)); void qc.invalidateQueries({ queryKey: ['floor'] }); } });
  const missing = active.filter((i) => !i.checkedOff);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ to: '/staff/work', label: 'My work' }} title={<span className="flex items-center gap-2">Pack <Ticket size="lg">{o.orderNo}</Ticket></span>} intro={o.deliveryFlag ? 'This order will be delivered.' : 'The customer collects at the counter.'} />
      {packed ? (
        <>
          <Alert tone="success" title={`Packed on shelf ${o.shelf}.`}>{o.deliveryFlag ? 'It is in the delivery queue.' : 'The customer has been notified.'}</Alert>
          <BigActionButton onClick={() => nav('/staff/work')}>Back to My work</BigActionButton>
        </>
      ) : (
        <>
          <Section title="1. Where will the bag go?">
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (shelf.trim()) setShelfSet(true); }}>
              <div className="flex-1">
                <Field label="Shelf or location" required hint="This goes in the customer's ready message.">
                  {(p) => <input {...p} className="input text-lg font-semibold uppercase" value={shelf} onChange={(e) => { setShelf(e.target.value.toUpperCase()); setShelfSet(false); }} placeholder="e.g. A-04" />}
                </Field>
              </div>
              {!shelfSet && <button className="btn-primary mb-[1.6rem]" disabled={!shelf.trim()}>Set</button>}
            </form>
          </Section>
          <Section title="2. Scan each item into the bag">
            <div className="mb-3">
              <div className="mb-1 flex justify-between text-sm font-semibold"><span>{checked} of {active.length} checked</span>{missing.length > 0 && <span className="text-slate">Missing: {missing.map((i) => i.tag).join(', ')}</span>}</div>
              <div className="h-3 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={active.length} aria-valuenow={checked} aria-label="Packing progress">
                <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(checked / Math.max(1, active.length)) * 100}%` }} />
              </div>
            </div>
            {shelfSet ? (
              <ScanInput label="Scan item for the packing check" onScan={(t) => check.mutate(t)} busy={check.isPending} buttonLabel="Check off" />
            ) : (
              <p className="hint">Set the shelf first.</p>
            )}
            <ul className="mt-3 space-y-1.5">
              {active.map((i) => (
                <li key={i.id} className={`flex items-center justify-between rounded-[12px] px-3 py-2.5 ${i.checkedOff ? 'bg-success-wash' : 'bg-mist'}`}>
                  <span><Ticket>{i.tag}</Ticket> <span className="text-sm">{names.category(i.categoryId)} {i.weightKg ? `${i.weightKg} kg` : `× ${i.quantity}`}</span></span>
                  {i.checkedOff ? <span className="flex items-center gap-1 text-sm font-semibold text-success"><Check size={16} aria-hidden /> In the bag</span> : <span className="text-sm text-slate">Not yet</span>}
                </li>
              ))}
            </ul>
            <div className="mt-3"><ErrorAlert error={check.error ?? finalise.error} /></div>
          </Section>
          {checked === active.length && shelfSet && <BigActionButton onClick={() => finalise.mutate()} disabled={finalise.isPending}>Mark packed</BigActionButton>}
          <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"><a className="btn-link" href={`/print/manifest/${o.id}`} target="_blank" rel="noreferrer">Print the packing check</a><Link className="btn-link" to="/staff/work">Back to my work</Link></p>
        </>
      )}
    </div>
  );
}
