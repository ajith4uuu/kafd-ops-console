import { useEffect, useState } from 'react';
import { Badge, Card, DataTable, Kpi, num, sar } from '../components/ui';
import {
  PACING_CAP_PER_SLOT,
  SEED_RESERVATIONS,
  SEED_WAITLIST,
  TABLES,
  canTransition,
  noShowFee,
  suggestTable,
  tableFreeAt,
  toMin,
  turnMinutes,
  waitlistQuote,
  type DineTable,
  type ResStatus,
  type Reservation,
  type WaitlistEntry,
} from '../data/dineops';

const STORE_KEY = 'kafd-resbook-v1';

interface BookState {
  reservations: Reservation[];
  waitlist: WaitlistEntry[];
}

function loadBook(): BookState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as BookState;
  } catch {
    // fall through to seeds
  }
  return { reservations: [...SEED_RESERVATIONS], waitlist: [...SEED_WAITLIST] };
}

const STATUS_TONE: Record<ResStatus, 'green' | 'amber' | 'peri' | 'red'> = {
  booked: 'amber',
  confirmed: 'peri',
  seated: 'green',
  finished: 'green',
  no_show: 'red',
  cancelled: 'red',
};

/** The service clock the floor renders against. */
const SERVICE_NOW = '19:15';

export function ReservationsPage() {
  const [book, setBook] = useState<BookState>(loadBook);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(book));
    } catch {
      // quota — session copy stays in memory
    }
  }, [book]);

  const live = book.reservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show');
  const covers = live.reduce((s, r) => s + r.party, 0);
  const deposits = book.reservations.reduce((s, r) => s + r.depositPaidSar, 0);
  const noShowsTonight = book.reservations.filter((r) => r.status === 'no_show');

  const move = (id: string, to: ResStatus) =>
    setBook((prev) => ({
      ...prev,
      reservations: prev.reservations.map((r) => {
        if (r.id !== id || !canTransition(r.status, to)) return r;
        // Seating an unassigned party auto-assigns the smartest free table.
        const tableId =
          to === 'seated' && r.tableId == null
            ? suggestTable(prev.reservations, r.party, r.time, r.zonePref, r.id)?.id ?? null
            : r.tableId;
        return { ...r, status: to, tableId };
      }),
    }));

  const promote = (entry: WaitlistEntry) => {
    const quote = waitlistQuote(book.reservations, entry.party, SERVICE_NOW);
    if (!quote) return;
    setBook((prev) => ({
      waitlist: prev.waitlist.filter((w) => w.id !== entry.id),
      reservations: [
        ...prev.reservations,
        {
          id: `rs-wl-${Date.now()}`,
          guestName: entry.guestName,
          party: entry.party,
          time: quote,
          status: 'confirmed',
          tableId: suggestTable(prev.reservations, entry.party, quote)?.id ?? null,
          depositPaidSar: 0,
        },
      ],
    }));
  };

  /** A table's state on the floor right now. */
  const tableState = (t: DineTable): { tone: 'green' | 'amber' | 'red'; label: string } => {
    const seatedHere = book.reservations.find((r) => r.tableId === t.id && r.status === 'seated');
    if (seatedHere) {
      const freeAt = toMin(seatedHere.time) + turnMinutes(seatedHere.party);
      return { tone: 'red', label: `${seatedHere.guestName.split(',')[0]} · frees ${String(Math.floor(freeAt / 60)).padStart(2, '0')}:${String(freeAt % 60).padStart(2, '0')}` };
    }
    if (!tableFreeAt(book.reservations, t.id, SERVICE_NOW, 2)) return { tone: 'amber', label: 'reserved' };
    return { tone: 'green', label: 'open' };
  };

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Reservations tonight" value={num(live.length)} />
        <Kpi label="Covers" value={num(covers)} />
        <Kpi label="Seated now" value={String(book.reservations.filter((r) => r.status === 'seated').length)} />
        <Kpi label="Waitlist" value={String(book.waitlist.length)} />
        <Kpi label="Deposits held" value={sar(deposits)} />
        <Kpi label="No-show fees tonight" value={sar(noShowsTonight.reduce((s, r) => s + noShowFee(r), 0))} />
      </div>

      <Card
        title={`Floor — Il Baretto at ${SERVICE_NOW}`}
        foot={`Pacing cap: ${PACING_CAP_PER_SLOT} seatings per 15-minute slot, so the kitchen never gets slammed. Turn windows: 90 min for two, 105 for four, 120 for six-plus.`}
        data-testid="floor-card"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {TABLES.map((t) => {
            const st = tableState(t);
            return (
              <div
                key={t.id}
                style={{
                  border: `1px solid ${st.tone === 'green' ? 'rgba(126,203,147,0.5)' : st.tone === 'amber' ? 'rgba(232,180,99,0.5)' : 'rgba(255,141,161,0.5)'}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong>{t.label}</strong>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>{t.zone} · {t.seats}</span>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Reservation book — tonight"
        foot="Seat auto-assigns the smallest fitting free table in the guest's preferred zone. No-show forfeits exactly the deposit held — never more. The lifecycle refuses illegal jumps (a booked party must be confirmed before seating)."
        data-testid="book-card"
      >
        <DataTable<Reservation>
          rowKey={(r) => r.id}
          columns={[
            { key: 'time', label: 'Time', render: (r) => r.time },
            { key: 'guest', label: 'Guest', render: (r) => r.guestName },
            { key: 'party', label: 'Party', render: (r) => String(r.party) },
            {
              key: 'table',
              label: 'Table',
              render: (r) =>
                r.tableId ? TABLES.find((t) => t.id === r.tableId)?.label ?? r.tableId : (
                  <span style={{ opacity: 0.6, fontSize: 12 }}>
                    → {suggestTable(book.reservations, r.party, r.time, r.zonePref, r.id)?.label ?? 'none free'}
                  </span>
                ),
            },
            { key: 'deposit', label: 'Deposit', render: (r) => (r.depositPaidSar > 0 ? sar(r.depositPaidSar) : '—') },
            { key: 'notes', label: 'Notes', render: (r) => <span style={{ fontSize: 12, opacity: 0.75 }}>{r.notes ?? ''}</span> },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status.replace('_', '-')}</Badge>
                  {canTransition(r.status, 'confirmed') && <button className="btn" onClick={() => move(r.id, 'confirmed')}>Confirm</button>}
                  {canTransition(r.status, 'seated') && <button className="btn primary" onClick={() => move(r.id, 'seated')}>Seat</button>}
                  {canTransition(r.status, 'finished') && <button className="btn" onClick={() => move(r.id, 'finished')}>Finish</button>}
                  {canTransition(r.status, 'no_show') && (
                    <button className="btn" title={`Forfeits ${sar(noShowFee(r))}`} onClick={() => move(r.id, 'no_show')}>
                      No-show{r.depositPaidSar > 0 ? ` (${sar(noShowFee(r))})` : ''}
                    </button>
                  )}
                </span>
              ),
            },
          ]}
          rows={[...book.reservations].sort((a, b) => toMin(a.time) - toMin(b.time))}
        />
      </Card>

      <Card
        title={`Waitlist (${book.waitlist.length})`}
        foot="Promote quotes the first 15-minute slot with pacing room AND a fitting free table — an honest wait time, not a guess."
        data-testid="waitlist-card"
      >
        {book.waitlist.length === 0 ? (
          <span style={{ fontSize: 13, opacity: 0.6 }}>Waitlist clear.</span>
        ) : (
          book.waitlist.map((w) => {
            const quote = waitlistQuote(book.reservations, w.party, SERVICE_NOW);
            return (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span style={{ flex: 1, fontSize: 13.5 }}>{w.guestName} · {w.party} {w.party === 1 ? 'guest' : 'guests'} · asked {w.askedAt}</span>
                {quote ? (
                  <>
                    <Badge tone="peri">next: {quote}</Badge>
                    <button className="btn primary" onClick={() => promote(w)}>Promote</button>
                  </>
                ) : (
                  <Badge tone="red">no table tonight</Badge>
                )}
              </div>
            );
          })
        )}
      </Card>
    </>
  );
}
