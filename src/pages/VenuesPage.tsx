import { Badge, Card, DataTable, num } from '../components/ui';
import { venueStatusNow } from '../data/analytics';
import { DINE_PACING, VENUE_HOURS, type VenueHoursRow } from '../data/seed';

export function VenuesPage() {
  const now = new Date();
  const coversFor = (id: string) =>
    DINE_PACING.filter((p) => p.venueId === id).reduce((sum, p) => sum + p.seatings, 0);

  return (
    <>
      <Card
        title="Trading hours — the awkward truths, modelled"
        foot="Split lunch/dinner services, past-midnight closes that belong to the previous day, and 24-hour trading — the booking engine refuses a table the kitchen can't serve."
        data-testid="hours-card"
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Badge tone="amber">Benoit shuts 16:00–19:00 daily</Badge>
          <Badge tone="peri">Rowley's runs to 02:00 Wed–Thu</Badge>
          <Badge tone="green">12 Cups trades around the clock Sun–Fri</Badge>
        </div>
      </Card>

      <Card title={`Venue board — live at ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}>
        <DataTable<VenueHoursRow>
          rowKey={(v) => v.id}
          columns={[
            { key: 'name', label: 'Venue', render: (v) => v.name },
            { key: 'hours', label: 'Hours today', render: (v) => venueStatusNow(v, now).label },
            {
              key: 'open',
              label: 'Now',
              render: (v) => (
                <Badge tone={venueStatusNow(v, now).open ? 'green' : 'red'}>
                  {venueStatusNow(v, now).open ? 'Open' : 'Closed'}
                </Badge>
              ),
            },
            {
              key: 'bookable',
              label: 'Bookable',
              render: (v) => <Badge tone={v.bookable ? 'green' : 'peri'}>{v.bookable ? 'Yes' : 'Walk-in'}</Badge>,
            },
            { key: 'covers', label: 'Seatings modelled', render: (v) => num(coversFor(v.id)) || '—' },
          ]}
          rows={VENUE_HOURS}
        />
      </Card>
    </>
  );
}
