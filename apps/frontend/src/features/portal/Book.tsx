// SRS-LDY-A-06 (COULD): book a pickup or drop-off in three steps (REDESIGN §8). Prices are confirmed at the counter.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Truck } from 'lucide-react';
import { api, ApiError, type Booking } from '@ldy/api-client';
import { ErrorAlert, Field, KeyValue, PageHeader, Section, Stepper, Ticket, useToast } from '@/components/ui';
import { useCatalogue, useNames, useSettings } from '@/config/settings';
import { day as fmtDay, todayISO } from '@/lib/format';
import { errorCode } from '@/lib/errors';

export function Book() {
  const qc = useQueryClient();
  const toast = useToast();
  const cat = useCatalogue();
  const names = useNames();
  const settings = useSettings();
  const me = useQuery({ queryKey: ['portal', 'me'], queryFn: api.portal.me });
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<'PICKUP' | 'DROPOFF'>('PICKUP');
  const [service, setService] = useState('');
  const [address, setAddress] = useState<string | null>(null);
  const [day, setDay] = useState(todayISO(1));
  const [slot, setSlot] = useState('');
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);
  const slots = useQuery({ queryKey: ['slots', day], queryFn: () => api.bookings.slots(day), enabled: Boolean(day) && step >= 1 });
  const addr = address ?? me.data?.address ?? '';
  const create = useMutation({
    mutationFn: () => api.bookings.create({ serviceTypeId: service, kind, address: kind === 'PICKUP' ? addr : undefined, date: day, slot }),
    onSuccess: (b) => {
      toast(`Booking ${b.bookingNo} confirmed for ${fmtDay(b.date)} at ${b.slot}.`);
      setDone(b);
      void qc.invalidateQueries({ queryKey: ['slots'] });
      void qc.invalidateQueries({ queryKey: ['portal', 'bookings'] });
    },
    onError: (e) => {
      void qc.invalidateQueries({ queryKey: ['slots', day] });
      if (errorCode(e) === 'SLOT_FULL') setStep(1);
    },
  });
  const alternatives = create.error instanceof ApiError && errorCode(create.error) === 'SLOT_FULL' ? (create.error.details?.alternatives as string[]) ?? [] : [];
  const b = settings.data?.bookings;
  const locate = () => {
    if (!('geolocation' in navigator)) return setLocMsg('This browser cannot share a location.');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const gps = `GPS ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`;
        setAddress((a) => `${(a ?? addr).replace(/\s*\(GPS [^)]*\)$/, '')} (${gps})`.trim());
        setLocMsg('Location added. Keep a landmark in the address for the rider.');
      },
      () => setLocMsg('Location access was not allowed. Type the address instead.'),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="Booking confirmed" />
        <Section>
          <p className="mb-3"><Ticket size="lg">{done.bookingNo}</Ticket></p>
          <KeyValue rows={[
            ['What', done.kind === 'PICKUP' ? 'A rider collects from you' : 'You bring it to the branch'],
            ['When', `${fmtDay(done.date)} at ${done.slot}`],
            ...(done.address ? ([['Where', done.address]] as [string, string][]) : []),
            ['Service', names.service(done.serviceTypeId)],
          ]} />
          <p className="hint mt-3">We'll message you. You can cancel up to {b?.cancelCutoffHours ?? 2} hours before the slot.</p>
        </Section>
        <MyBookings />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Book a pickup or drop-off" intro="Prices are confirmed when your items are counted at the branch." />
      <Stepper steps={['Service', 'Day and time', 'Confirm']} current={step} />

      {step === 0 && (
        <Section>
          <fieldset>
            <legend className="label">How will your laundry reach us?</legend>
            <div className="grid grid-cols-2 gap-2">
              {([['PICKUP', 'Pick up from me', <Truck key="t" size={26} />], ['DROPOFF', 'I will drop it off', <Building2 key="b" size={26} />]] as const).map(([k, l, icon]) => (
                <label key={k} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-[16px] border-2 p-4 text-center text-sm font-bold ${kind === k ? 'border-blue bg-sky text-blue-dark' : 'border-line'}`}>
                  <input type="radio" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
                  <span aria-hidden className="text-blue">{icon}</span>{l}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4">
            <Field label="Service" required>
              {(p) => (
                <select {...p} className="input" value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="">Choose a service</option>
                  {cat.data?.serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
            </Field>
          </div>
          {kind === 'PICKUP' && (
            <div className="mt-4">
              <Field label="Pickup address" icon={<MapPin size={16} />} required>
                {(p) => <textarea {...p} className="input" rows={2} value={addr} onChange={(e) => setAddress(e.target.value)} />}
              </Field>
              <button type="button" className="btn mt-2 w-full" onClick={locate}><MapPin size={18} aria-hidden /> Use my location</button>
              {locMsg && <p className="hint">{locMsg}</p>}
            </div>
          )}
          <button className="btn-primary mt-5 w-full" disabled={!service || (kind === 'PICKUP' && !addr.trim())} onClick={() => setStep(1)}>Next</button>
        </Section>
      )}

      {step === 1 && (
        <Section>
          <Field label="Day" required>
            {(p) => <input {...p} type="date" className="input" min={todayISO()} value={day} onChange={(e) => { setDay(e.target.value); setSlot(''); }} />}
          </Field>
          {b && <p className="hint">Open {String(b.openHour).padStart(2, '0')}:00 to {b.closeHour}:00.</p>}
          <fieldset className="mt-4">
            <legend className="label">Time</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.data?.map((s) => (
                <button
                  key={s.slot}
                  type="button"
                  disabled={s.full}
                  aria-pressed={slot === s.slot}
                  onClick={() => setSlot(s.slot)}
                  className={`rounded-[12px] border px-2 py-2.5 text-center ${slot === s.slot ? 'border-blue bg-sky font-bold text-blue-dark' : 'border-line bg-white'} disabled:cursor-not-allowed disabled:bg-mist disabled:text-slate`}
                >
                  <span className="block font-semibold">{s.slot}</span>
                  <span className="block text-xs">{s.full ? 'Full' : `${s.capacity - s.booked} left`}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {alternatives.length > 0 && (
            <div className="mt-3">
              <ErrorAlert error={create.error} />
              <p className="mt-2 text-sm">Free times on this day: {alternatives.map((a) => <button key={a} className="btn-link mr-2" onClick={() => setSlot(a)}>{a}</button>)}</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => setStep(0)}>Back</button>
            <button className="btn-primary" disabled={!slot} onClick={() => setStep(2)}>Next</button>
          </div>
        </Section>
      )}

      {step === 2 && (
        <Section>
          <KeyValue rows={[
            ['What', kind === 'PICKUP' ? 'A rider collects from you' : 'You bring it to the branch'],
            ['Service', names.service(service)],
            ['When', `${fmtDay(day)} at ${slot}`],
            ...(kind === 'PICKUP' ? ([['Where', addr]] as [string, string][]) : []),
          ]} />
          <div className="mt-4">{!alternatives.length && <ErrorAlert error={create.error} />}</div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="btn" onClick={() => setStep(1)}>Back</button>
            <button className="btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? 'Booking…' : 'Confirm booking'}</button>
          </div>
        </Section>
      )}
      <MyBookings />
    </div>
  );
}

function MyBookings() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation('status');
  const mine = useQuery({ queryKey: ['portal', 'bookings'], queryFn: api.bookings.mine });
  const cancel = useMutation({
    mutationFn: (id: string) => api.bookings.cancel(id),
    onSuccess: (b) => {
      toast(`Booking ${b.bookingNo} cancelled.`);
      void qc.invalidateQueries({ queryKey: ['portal', 'bookings'] });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
  if (!mine.data?.length) return null;
  return (
    <Section title="My bookings">
      <ul className="divide-y divide-line">
        {mine.data.map((bk) => (
          <li key={bk.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span><Ticket>{bk.bookingNo}</Ticket> {bk.kind === 'PICKUP' ? 'Pickup' : 'Drop-off'}, {fmtDay(bk.date)} at {bk.slot}</span>
            <span className="flex items-center gap-3">
              <span className="font-semibold">{t(`booking.${bk.status}`)}</span>
              {bk.status === 'CONFIRMED' && <button className="btn-danger min-h-9 px-3 text-sm" onClick={() => cancel.mutate(bk.id)}>Cancel</button>}
            </span>
          </li>
        ))}
      </ul>
      {cancel.error && <div className="mt-2"><ErrorAlert error={cancel.error} /></div>}
    </Section>
  );
}
