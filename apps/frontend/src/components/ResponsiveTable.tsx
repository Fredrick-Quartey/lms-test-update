import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Custom header cell (e.g. a sort button). */
  th?: ReactNode;
}

/**
 * REDESIGN §3.4: a real table from 768 px up, a stacked card list below it, so phones never scroll sideways.
 */
export function ResponsiveTable<T>({ rows, columns, rowKey, mobileCard, caption }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  mobileCard: (r: T) => ReactNode;
  caption?: string;
}) {
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="panel p-3.5">
            {mobileCard(r)}
          </li>
        ))}
      </ul>
      <div className="panel hidden overflow-x-auto md:block">
        <table className="table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>{columns.map((c) => c.th ?? <th key={c.key} className={c.className}>{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
