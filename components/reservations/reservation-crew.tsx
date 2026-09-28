"use client";

import { BusFront, UserRound } from "lucide-react";

import { CrewPicker, useCrewOptions, type CrewRow } from "@/components/trips/crew-picker";

export type ReservationCrewRow = CrewRow & { driverPhone: string | null };

/**
 * Who is on the job, and the place to put someone on it.
 *
 * One line per assignment row, so a two-coach charter reads as two crews
 * rather than a list of coaches beside a list of drivers that has to be paired
 * up by position. A trip with no row yet still offers both pickers; the first
 * pick creates the row.
 */
export function ReservationCrew({
  tripId,
  rows,
  canEdit,
}: {
  tripId: string;
  rows: ReservationCrewRow[];
  canEdit: boolean;
}) {
  const options = useCrewOptions(tripId, rows, canEdit);
  const lines: (ReservationCrewRow | null)[] = rows.length > 0 ? rows : [null];

  return (
    <div className="flex flex-col gap-1">
      {lines.map((row, index) => (
        <dl
          key={row?.id ?? `new-${index}`}
          className="flex flex-wrap items-center gap-x-8 gap-y-1 text-body-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <dt className="inline-flex items-center gap-1.5 text-slate [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ash">
              <BusFront aria-hidden="true" />
              Coach
            </dt>
            <dd className="flex min-w-0 items-center">
              <CrewPicker
                kind="vehicle"
                tripId={tripId}
                row={row}
                options={options}
                canEdit={canEdit}
                emptyLabel="Not assigned"
                assignedClassName="text-ink"
              />
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <dt className="inline-flex items-center gap-1.5 text-slate [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ash">
              <UserRound aria-hidden="true" />
              Driver
            </dt>
            <dd className="flex min-w-0 items-center gap-2">
              <CrewPicker
                kind="driver"
                tripId={tripId}
                row={row}
                options={options}
                canEdit={canEdit}
                emptyLabel="Not assigned"
                assignedClassName="text-ink"
              />
              {row?.driverName && row.driverPhone && (
                <a
                  href={`tel:${row.driverPhone.replace(/[^\d+]/g, "")}`}
                  className="tabular whitespace-nowrap text-slate hover:text-teal-600 hover:underline"
                >
                  {row.driverPhone}
                </a>
              )}
            </dd>
          </div>
        </dl>
      ))}
    </div>
  );
}
