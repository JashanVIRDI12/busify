import type { Metadata } from "next";
import { CalendarCheck, Route } from "lucide-react";

import { AssignedTripCard } from "@/components/driver/assigned-trip-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireDriver } from "@/lib/auth/session";
import { getAssignedTrips } from "@/lib/queries/driver";

export const metadata: Metadata = { title: "My trips" };

const FINISHED = new Set(["COMPLETED", "CANCELLED"]);

export default async function DriverTripsPage() {
  const { organization, driver } = await requireDriver();
  const timeZone = organization.timezone;
  const trips = await getAssignedTrips();

  const upcoming = trips.filter((t) => !FINISHED.has(t.status));
  const past = trips
    .filter((t) => FINISHED.has(t.status))
    .sort(
      (a, b) =>
        new Date(b.departure_at).getTime() - new Date(a.departure_at).getTime(),
    );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={organization.name}
        title={`Hi, ${driver.first_name}`}
        description="Every trip you're assigned to, and everything you need for it."
      />

      <section className="space-y-3">
        <h2 className="text-body-sm font-bold tracking-wide uppercase text-ash">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nothing on your schedule"
            description="When a dispatcher assigns you a trip, it shows up here."
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((trip) => (
              <AssignedTripCard key={trip.id} trip={trip} timeZone={timeZone} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-body-sm font-bold tracking-wide uppercase text-ash">
            Past
          </h2>
          <div className="space-y-3">
            {past.map((trip) => (
              <AssignedTripCard key={trip.id} trip={trip} timeZone={timeZone} />
            ))}
          </div>
        </section>
      )}

      {trips.length === 0 && (
        <p className="flex items-center gap-2 text-body-sm text-ash">
          <Route className="size-4" aria-hidden />
          Your trip history will build up here over time.
        </p>
      )}
    </div>
  );
}
