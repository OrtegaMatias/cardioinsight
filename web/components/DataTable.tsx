'use client';

import { useMemo, useState } from 'react';

export type Column<T> = { key: keyof T; label: string; format?: (value: T[keyof T]) => string };

export default function DataTable<T extends object>({ rows, columns, caption, initialSort, initialDescending = false }: {
  rows: T[]; columns: Column<T>[]; caption: string; initialSort?: keyof T; initialDescending?: boolean;
}) {
  const [sort, setSort] = useState<keyof T | undefined>(initialSort);
  const [descending, setDescending] = useState(initialDescending);
  const ordered = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const left = a[sort], right = b[sort];
      const order = typeof left === 'number' && typeof right === 'number'
        ? left - right : String(left).localeCompare(String(right), 'es', { numeric: true });
      return descending ? -order : order;
    });
  }, [rows, sort, descending]);
  return <div className="table-scroll" tabIndex={0} role="region" aria-label={`Tabla desplazable: ${caption}`}>
    <table><caption>{caption}</caption><thead><tr>{columns.map(column => <th scope="col" key={String(column.key)} aria-sort={sort === column.key ? descending ? 'descending' : 'ascending' : 'none'}>
      <button type="button" onClick={() => { if (sort === column.key) setDescending(!descending); else { setSort(column.key); setDescending(false); } }}>
        {column.label}<span className="sort-icon" aria-hidden="true">{sort === column.key ? descending ? ' ↓' : ' ↑' : ' ↕'}</span>
      </button>
    </th>)}</tr></thead><tbody>{ordered.map((row, index) => <tr key={index}>{columns.map(column => <td key={String(column.key)}>{column.format ? column.format(row[column.key]) : String(row[column.key] ?? '')}</td>)}</tr>)}</tbody></table>
  </div>;
}
