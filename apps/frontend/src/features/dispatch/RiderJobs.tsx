// Delivery Rider (mobile-first). D-02 Delivered / Delivery Failed; D-03 proof of delivery (signature or photo);
// A-06 pickup collection jobs.
import { useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Booking, type Order } from '@ldy/api-client';
import { Alert, ErrorAlert, Field, PageHeader, QueryState, Section, Ticket, useToast } from '@/components/ui';
import { PhotoInput, SignaturePad } from '@/components/inputs';
import { day, money, time } from '@/lib/format';
import { errorField, errorMessage, msg } from '@/lib/errors';

export function RiderJobs() {
  const q = useQuery({ queryKey: ['rider', 'jobs'], queryFn: api.rider.jobs, refetchInterval: 30_000 });
  return (
    <div>
      <PageHeader title="Today's stops" intro="Deliveries on routes that have left the branch, and pickups assigned to you." />
      <QueryState q={q} isEmpty={(d) => !d.length} empty="No jobs right now. New routes appear here when dispatch marks them departed.">
        {(jobs) => (
          <ul className="space-y-4">
            {jobs.map((j) => (
              <li key={j.order?.id ?? j.booking?.id}>
                {j.kind === 'DELIVER' && j.order ? <DeliverJob o={j.order} window={j.window} /> : j.booking ? <CollectJob b={j.booking} /> : null}
              </li>
            ))}
          </ul>
        )}
      </QueryState>
    </div>
  );
}

function DeliverJob({ o, window }: { o: Order; window?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<null | 'done' | 'failed'>(null);
  const [name, setName] = useState('');
  const [sig, setSig] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api.rider.deliveryOutcome(o.id, mode === 'done' ? { outcome: 'DELIVERED', recipientName: name, signature: sig ?? undefined, photo: photo ?? undefined } : { outcome: 'FAILED', reason }),
    onSuccess: (r) => {
      toast(r.status === 'DELIVERED' ? `${r.orderNo} delivered to ${r.pod?.recipientName} at ${time(r.deliveredAt)}. Proof saved.` : `${r.orderNo} not delivered. It is back in the dispatch queue.`);
      void qc.invalidateQueries({ queryKey: ['rider', 'jobs'] });
    },
  });
  const fieldErr = (f: string) => (errorField(m.error) === f ? errorMessage(m.error) : null);
  return (
    <Section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2"><Ticket>{o.orderNo}</Ticket> <span className="text-sm font-semibold">Deliver</span></span>
        {window && <span className="text-sm text-slate">{window}</span>}
      </div>
      <p className="mt-2 text-lg font-semibold">{o.customerName}</p>
      <p>{o.deliveryAddress}</p>
      <p className="mt-1 text-sm text-slate">{o.items.length} package line(s), from shelf {o.shelf}</p>
      <ContactButtons phone={o.customerPhone} address={o.deliveryAddress} />
      {o.balance > 0 && !o.onAccount && <Alert tone="warning">Balance not yet paid: {money(o.balance)}. Check with the branch before handing over.</Alert>}
      {!mode && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-success min-h-14 text-base" onClick={() => setMode('done')}>Delivered</button>
          <button className="btn-danger min-h-14 text-base" onClick={() => setMode('failed')}>Couldn't deliver</button>
        </div>
      )}
      {mode === 'done' && (
        <form className="mt-4 space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
          <Field label="Name of the person who received it" required error={fieldErr('recipientName')}>{(p) => <input {...p} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}</Field>
          <div>
            <p className="label">Signature</p>
            <SignaturePad onChange={setSig} />
          </div>
          <PhotoInput id={`pod-${o.id}`} label="Or a photo of the handover" value={photo} onChange={setPhoto} />
          {!sig && !photo && <p className="hint">{msg('POD_REQUIRED')}</p>}
          {errorField(m.error) !== 'recipientName' && <ErrorAlert error={m.error} />}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={m.isPending}>Confirm delivery</button>
            <button type="button" className="btn" onClick={() => setMode(null)}>Back</button>
          </div>
        </form>
      )}
      {mode === 'failed' && (
        <form className="mt-4 space-y-4" onSubmit={(e) => (e.preventDefault(), m.mutate())}>
          <Field label="Why couldn't it be delivered?" required error={fieldErr('reason')}>
            {(p) => (
              <select {...p} className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose a reason</option>
                <option>Customer not available</option>
                <option>Wrong or incomplete address</option>
                <option>Customer refused the order</option>
                <option>Could not reach the location</option>
              </select>
            )}
          </Field>
          {errorField(m.error) !== 'reason' && <ErrorAlert error={m.error} />}
          <div className="flex gap-2">
            <button className="btn-danger flex-1" disabled={!reason || m.isPending}>Record failed delivery</button>
            <button type="button" className="btn" onClick={() => setMode(null)}>Back</button>
          </div>
        </form>
      )}
    </Section>
  );
}

function CollectJob({ b }: { b: Booking }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({ mutationFn: () => api.rider.collectBooking(b.id), onSuccess: () => { toast(`${b.bookingNo} collected. Hand it to the counter.`); void qc.invalidateQueries({ queryKey: ['rider', 'jobs'] }); } });
  return (
    <Section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2"><Ticket>{b.bookingNo}</Ticket> <span className="text-sm font-semibold">Collect</span></span>
        <span className="text-sm text-slate">{day(b.date)} at {b.slot}</span>
      </div>
      <p className="mt-2 text-lg font-semibold">{b.customerName}</p>
      <p>{b.address}</p>
      <ContactButtons phone={b.customerPhone} address={b.address} />
      <ErrorAlert error={m.error} />
      <button className="btn-primary mt-4 w-full" onClick={() => m.mutate()} disabled={m.isPending}>Collected from customer</button>
    </Section>
  );
}

/** Call and Open in Maps (opens the address only: no live GPS, which is out of scope). */
function ContactButtons({ phone, address }: { phone: string; address?: string }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a className="btn" href={`tel:${phone}`}><Phone size={18} aria-hidden /> Call</a>
      {address ? (
        <a className="btn" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/^GPS\s*/, ''))}`} target="_blank" rel="noreferrer"><MapPin size={18} aria-hidden /> Open in Maps</a>
      ) : <span />}
    </div>
  );
}
