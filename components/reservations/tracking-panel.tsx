import { StopNotes } from "@/components/reservations/stop-notes";
import {
  StopTimeline,
  type TripStop,
} from "@/components/reservations/stop-timeline";
import { TripMap, type MapPoint } from "@/components/reservations/trip-map";

/**
 * Planned against actual, for the three figures a charter is billed on.
 *
 * Actual is blank on every row until a coach reports where it went. Shown
 * anyway, and labelled, because the gap is the point: an operator looking at
 * this wants to know whether the job ran as sold, and a table that appears only
 * once there is tracking data hides the fact that there is none.
 */
function SummaryTable({
  plannedMiles,
  plannedMinutes,
  plannedDays,
}: {
  plannedMiles: number;
  plannedMinutes: number;
  plannedDays: number;
}) {
  const rows = [
    {
      label: "Planned",
      miles: plannedMiles > 0 ? plannedMiles.toFixed(1) : "--",
      hours: plannedMinutes > 0 ? (plannedMinutes / 60).toFixed(1) : "--",
      days: plannedDays > 0 ? String(plannedDays) : "--",
    },
    { label: "Actual", miles: "--", hours: "--", days: "--" },
    { label: "Difference", miles: "--", hours: "--", days: "--" },
  ];

  return (
    <table className="w-full text-body-sm">
      <caption className="sr-only">
        Planned and actual distance, time and days for this reservation
      </caption>
      <thead>
        <tr className="text-[11px] tracking-wide text-ash uppercase">
          <th scope="col" className="pb-2 text-left font-semibold">
            Summary
          </th>
          <th scope="col" className="pb-2 text-right font-semibold">
            Km
          </th>
          <th scope="col" className="pb-2 text-right font-semibold">
            Hours
          </th>
          <th scope="col" className="pb-2 text-right font-semibold">
            Days
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t border-bone">
            <th scope="row" className="py-2 text-left font-medium text-ink">
              {row.label}
            </th>
            <td className="tabular py-2 text-right text-slate">{row.miles}</td>
            <td className="tabular py-2 text-right text-slate">{row.hours}</td>
            <td className="tabular py-2 text-right text-slate">{row.days}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Where the coach is going, and how that compares to what was sold.
 *
 * Nothing here is live. Tracking a vehicle needs a vehicle reporting its
 * position, and there is no source of that yet — so the panel says "no tracking
 * information" rather than drawing a coach at its pickup and implying it is
 * sitting there.
 */
export function TrackingPanel({
  points,
  stops,
  timeZone,
  canEdit,
  plannedMiles,
  plannedMinutes,
  plannedDays,
}: {
  points: MapPoint[];
  stops: TripStop[];
  timeZone: string;
  canEdit: boolean;
  plannedMiles: number;
  plannedMinutes: number;
  plannedDays: number;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-3 border-b border-bone pb-2 text-[11px] font-semibold tracking-wide text-ash uppercase">
          <span>Stop</span>
          <span>Type</span>
          <span className="text-right">Planned</span>
        </div>
        <StopTimeline
          stops={stops}
          timeZone={timeZone}
          renderNotes={(stop) => (
            <StopNotes stopId={stop.id} notes={stop.notes} canEdit={canEdit} />
          )}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
        <TripMap points={points} />

        <div className="space-y-4">
          <div className="rounded-xl border border-bone bg-mist/40 p-4 text-center">
            <p className="text-body-sm text-ash">No tracking information</p>
            <p className="mt-1 text-[12px] text-ash">
              Live positions need a coach reporting them.
            </p>
          </div>

          <div className="rounded-xl border border-bone p-4">
            <SummaryTable
              plannedMiles={plannedMiles}
              plannedMinutes={plannedMinutes}
              plannedDays={plannedDays}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
