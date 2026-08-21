import type { ReactNode } from 'react';
import type { Range } from '../data/analytics';

export function Kpi({
  label,
  value,
  trend,
  invertTrend,
}: {
  label: string;
  value: string;
  trend?: number;
  /** For metrics where down is good (no-shows, ETA). */
  invertTrend?: boolean;
}) {
  const direction = trend == null || trend === 0 ? 'flat' : trend > 0 !== Boolean(invertTrend) ? 'up' : 'down';
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {trend != null ? (
        <div className={`trend ${direction}`}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '■'} {Math.abs(trend)}% vs prev. period
        </div>
      ) : null}
    </div>
  );
}

export function Card({ title, foot, children, ...rest }: { title: string; foot?: string; children: ReactNode }) {
  return (
    <div className="card" {...rest}>
      <h3>{title}</h3>
      {children}
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'peri'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function RangePicker({ value, onChange }: { value: Range; onChange: (next: Range) => void }) {
  return (
    <div className="range-picker" role="tablist" aria-label="Date range">
      {([7, 30, 90] as const).map((option) => (
        <button
          key={option}
          role="tab"
          aria-selected={value === option}
          className={value === option ? 'active' : ''}
          onClick={() => onChange(option)}
        >
          {option}d
        </button>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: readonly T[]; rowKey: (row: T) => string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function sar(value: number): string {
  return `SAR ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function num(value: number): string {
  return value.toLocaleString('en-US');
}

export const CHART = {
  peri: '#c5cfe4',
  periDeep: '#8fa3cd',
  green: '#7ecb93',
  amber: '#e8b463',
  red: '#ff8da1',
  grid: 'rgba(255,255,255,0.07)',
  axis: '#8d99af',
};

export function shortDay(day: string): string {
  return day.slice(5).replace('-', '/');
}
