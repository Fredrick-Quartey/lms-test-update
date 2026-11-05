// SRS-LDY-F-06: CSV templates, full validation before commit, row-by-row report, commit all or only valid rows.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ImportBatch } from '@ldy/api-client';
import { Alert, ErrorAlert, Field, PageHeader, Pill, Section, useToast } from '@/components/ui';
import { dateTime, downloadText } from '@/lib/format';
import { msg } from '@/lib/errors';

type Kind = ImportBatch['entityType'];
const KINDS: { k: Kind; l: string }[] = [
  { k: 'customers', l: 'Customers (including corporate accounts)' },
  { k: 'prices', l: 'Price list' },
  { k: 'machines', l: 'Machines and stations' },
];

export function Import() {
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const history = useQuery({ queryKey: ['imports'], queryFn: api.imports.list });
  const tpl = useMutation({ mutationFn: () => api.imports.template(kind), onSuccess: (r) => downloadText(r.filename, r.csv) });
  const validate = useMutation({ mutationFn: async () => api.imports.validate(kind, file!.name, await file!.text()), onSuccess: setBatch });
  const commit = useMutation({
    mutationFn: (mode: 'ALL' | 'VALID_ONLY') => api.imports.commit(batch!.id, mode),
    onSuccess: (b) => {
      toast(`${b.rowsCommitted} row(s) imported.`);
      setBatch(null);
      setFile(null);
      void qc.invalidateQueries();
    },
  });
  return (
    <div>
      <PageHeader title="Import data" intro="Load existing records from a spreadsheet before go-live. Nothing is saved until the whole file has been checked and you choose what to commit." />
      <div className="space-y-5">
        <Section title="1. Choose what to import and get the template">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Records">{(p) => <select {...p} className="input" value={kind} onChange={(e) => { setKind(e.target.value as Kind); setBatch(null); }}>{KINDS.map((x) => <option key={x.k} value={x.k}>{x.l}</option>)}</select>}</Field>
            <button className="btn" onClick={() => tpl.mutate()}>Download CSV template</button>
          </div>
        </Section>
        <Section title="2. Upload the filled-in file">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => (e.preventDefault(), validate.mutate())}>
            <div>
              <label className="label" htmlFor="csv">CSV file</label>
              <input id="csv" type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setBatch(null); }} className="block text-sm file:mr-3 file:min-h-11 file:rounded-[12px] file:border file:border-line file:bg-white file:px-3 file:font-semibold" />
            </div>
            <button className="btn-primary" disabled={!file || validate.isPending}>Check the file</button>
          </form>
          <div className="mt-2"><ErrorAlert error={validate.error} /></div>
        </Section>
        {batch && (
          <Section title="3. Review and commit">
            {batch.rowsRejected === 0 ? (
              <Alert tone="success">All {batch.rowsTotal} row(s) passed validation.</Alert>
            ) : (
              <Alert tone="warning">{msg('IMPORT_VALIDATION_FAILED', { count: batch.rowsRejected, valid: batch.rowsValid })}</Alert>
            )}
            <div className="mt-3 overflow-x-auto">
              <table className="table">
                <thead><tr><th>Row</th><th>Data</th><th>Result</th></tr></thead>
                <tbody>
                  {batch.rows.map((r) => (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td className="text-xs">{Object.values(r.data).filter(Boolean).join(', ')}</td>
                      <td>{r.errors.length ? <span className="text-danger">{r.errors.join('; ')}</span> : <Pill tone="good">OK</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {batch.rowsRejected > 0 && (
                <button className="btn" onClick={() => downloadText(`${batch.fileName.replace(/\.csv$/i, '')}-report.csv`, ['row,errors', ...batch.rows.filter((r) => r.errors.length).map((r) => `${r.row},"${r.errors.join('; ').replace(/"/g, '""')}"`)].join('\n'))}>Download error report</button>
              )}
              {batch.rowsRejected === 0 ? (
                <button className="btn-primary" onClick={() => commit.mutate('ALL')} disabled={commit.isPending}>Import all {batch.rowsTotal} row(s)</button>
              ) : (
                <button className="btn-primary" onClick={() => commit.mutate('VALID_ONLY')} disabled={commit.isPending || batch.rowsValid === 0}>Import only the {batch.rowsValid} valid row(s)</button>
              )}
            </div>
            <div className="mt-2"><ErrorAlert error={commit.error} /></div>
          </Section>
        )}
        <Section title="Previous imports">
          {!history.data?.length && <p className="muted text-sm">None yet.</p>}
          <ul className="divide-y divide-line text-sm">
            {history.data?.map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong>{b.fileName}</strong>, {b.entityType}</span>
                <span className="text-slate">{b.status === 'COMMITTED' ? `${b.rowsCommitted} imported, ${b.rowsRejected} rejected` : 'Checked, not committed'}, {b.runBy}, {dateTime(b.runAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
