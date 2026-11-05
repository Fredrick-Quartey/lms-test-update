// SRS-LDY-E-02: capture cash / card / mobile money, partial payments, receipt for every payment.
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Order, type Payment } from '@ldy/api-client';
import { ErrorAlert, Field, useToast } from './ui';
import { errorField, errorMessage } from '@/lib/errors';
import { money } from '@/lib/format';

export function PaymentPanel({ order, onPaid }: { order: Order; onPaid?: (o: Order, p: Payment) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [amount, setAmount] = useState(order.balance.toFixed(2));
  const [method, setMethod] = useState<Payment['method']>('CASH');
  const [reference, setReference] = useState('');
  const [tendered, setTendered] = useState('');
  const [last, setLast] = useState<Payment | null>(null);
  const pay = useMutation({
    mutationFn: () =>
      api.orders.pay(order.id, {
        amount: Number(amount),
        method,
        reference: method === 'CASH' ? undefined : reference.trim(),
        tendered: method === 'CASH' && tendered ? Number(tendered) : undefined,
      }),
    onSuccess: ({ order: o, payment }) => {
      setLast(payment);
      setAmount(o.balance.toFixed(2));
      setReference('');
      setTendered('');
      toast(`Payment of ${money(payment.amount)} recorded. Receipt ${payment.receiptNo}.`);
      qc.setQueryData(['order', o.id], o);
      void qc.invalidateQueries({ queryKey: ['orders'] });
      onPaid?.(o, payment);
    },
  });
  const send = useMutation({
    mutationFn: (channel: 'SMS' | 'EMAIL') => api.orders.sendReceipt(last!.id, channel),
    onSuccess: (_d, ch) => toast(`Receipt sent by ${ch === 'SMS' ? 'SMS' : 'email'}.`),
  });

  if (order.onAccount) return <p className="text-sm">Billed to the corporate account. It will appear on the monthly statement.</p>;
  const change = method === 'CASH' && tendered ? Number(tendered) - Number(amount) : null;
  const err = (f: string) => (errorField(pay.error) === f ? errorMessage(pay.error) : null);

  return (
    <div className="space-y-4">
      {order.balance <= 0 ? (
        <p className="font-semibold text-success">Fully paid.</p>
      ) : (
        <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), pay.mutate())}>
          <p className="text-sm">
            Balance due <strong className="text-base">{money(order.balance)}</strong>. Take part or all of it now; the rest is collected at pickup.
          </p>
          <fieldset>
            <legend className="label">Method</legend>
            <div className="flex flex-wrap gap-2">
              {(['CASH', 'MOMO', 'CARD'] as const).map((m) => (
                <label key={m} className={`btn cursor-pointer ${method === m ? 'border-blue bg-sky' : ''}`}>
                  <input type="radio" name="method" className="sr-only" checked={method === m} onChange={() => setMethod(m)} />
                  {m === 'CASH' ? 'Cash' : m === 'MOMO' ? 'Mobile money' : 'Card'}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" error={err('amount')} required>
              {(p) => <input {...p} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
            {method === 'CASH' ? (
              <Field label="Cash tendered (optional)" error={err('tendered')} hint={change !== null && change >= 0 ? `Change to give: ${money(change)}` : undefined}>
                {(p) => <input {...p} className="input" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} />}
              </Field>
            ) : (
              <Field label={method === 'MOMO' ? 'Mobile money transaction ID' : 'Card terminal reference'} error={err('reference')} required>
                {(p) => <input {...p} className="input" value={reference} onChange={(e) => setReference(e.target.value)} />}
              </Field>
            )}
          </div>
          {!errorField(pay.error) && <ErrorAlert error={pay.error} />}
          <button className="btn-primary" disabled={pay.isPending || !(Number(amount) > 0)}>
            Record {money(Number(amount) || 0)} payment
          </button>
        </form>
      )}
      {last && (
        <div className="rounded-[12px] border border-line bg-mist p-3 text-sm">
          <p>
            Receipt <strong>{last.receiptNo}</strong> issued.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn" href={`/print/receipt/${last.id}`} target="_blank">Print receipt</a>
            <button className="btn" onClick={() => send.mutate('SMS')} disabled={send.isPending}>Send by SMS</button>
            <button className="btn" onClick={() => send.mutate('EMAIL')} disabled={send.isPending}>Send by email</button>
          </div>
        </div>
      )}
    </div>
  );
}
