/**
 * Check (C-01): one item at a time, care notes first, two big buttons: Passed or Problem.
 * After each outcome the next item appears, so the attendant never navigates (REDESIGN §9.4).
 */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@ldy/api-client';
import { Empty, ErrorAlert, Loading, PageHeader, Section, Ticket, useToast } from '@/components/ui';
import { ScanInput } from '@/components/inputs';
import { CheckPanel, ItemSummary, MoreActions } from './shared';

export function Check() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [picked, setPicked] = useState<string | null>(params.get('tag'));
  const queue = useQuery({ queryKey: ['floor', 'queue'], queryFn: api.loads.queue, refetchInterval: 15_000 });
  const tag = picked ?? queue.data?.readyForCheck[0]?.tag ?? null;
  const item = useQuery({ queryKey: ['scan', tag], queryFn: () => api.tags.scan(tag!), enabled: Boolean(tag), retry: false });
  const left = queue.data?.readyForCheck.length ?? 0;
  const next = (m: string) => {
    toast(m);
    setPicked(null);
    setParams({}, { replace: true });
    void queue.refetch();
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader back={{ to: '/staff/work', label: 'My work' }} title="Check" intro={queue.data ? `${left} item${left === 1 ? '' : 's'} waiting for a check.` : undefined} />
      <Section>
        <ScanInput label="Scan the item you're holding" placeholder="Scan the item in your hand" onScan={(t) => setPicked(t)} buttonLabel="Check this" autoFocus={false} />
      </Section>
      {!tag && queue.data && (
        <Empty action={<Link to="/staff/work" className="btn">Back to My work</Link>}>Nothing waiting for a check.</Empty>
      )}
      {tag && item.isPending && <Loading rows={1} />}
      {item.isError && <ErrorAlert error={item.error} />}
      {item.data && (
        <Section>
          <ItemSummary r={item.data} />
          <div className="mt-5">
            {item.data.nextAction === 'QC' ? (
              <CheckPanel key={item.data.item.id} r={item.data} onDone={next} />
            ) : (
              <p className="text-sm">
                <Ticket>{item.data.item.tag}</Ticket> doesn't need a check right now.{' '}
                <Link className="btn-link" to={`/staff/scan?tag=${item.data.item.tag}`}>See what it needs</Link>
              </p>
            )}
          </div>
          <div className="mt-4 flex justify-end"><MoreActions r={item.data} onChanged={() => void item.refetch()} /></div>
        </Section>
      )}
      {queue.data && left > 1 && (
        <p className="text-center text-sm text-slate">Next up: {queue.data.readyForCheck.filter((x) => x.tag !== tag).slice(0, 3).map((x) => x.tag).join(', ')}</p>
      )}
    </div>
  );
}
