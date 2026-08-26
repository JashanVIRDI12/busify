import { BusFront, CircleAlert, CircleCheck, UserSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FleetAvailability } from "@/lib/queries/availability";
import { cn, formatNumber } from "@/lib/utils";

export function FleetAvailabilityPanel({
  availability,
  passengerCount,
}: {
  availability: FleetAvailability;
  passengerCount: number;
}) {
  const { vehicles, drivers, seatsAvailable, vehiclesNeeded, meetsDemand } =
    availability;

  const availableVehicles = vehicles.filter((entry) => entry.available);
  const unavailableVehicles = vehicles.filter((entry) => !entry.available);
  const availableDrivers = drivers.filter((entry) => entry.available);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Fleet availability</CardTitle>
          <CardDescription>
            Vehicles free across these exact dates, excluding anything in
            maintenance or already on another trip.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3",
            meetsDemand
              ? "border-success/25 bg-success/8"
              : "border-warning/30 bg-warning/10",
          )}
        >
          {meetsDemand ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          )}
          <div className="text-sm">
            <p className="font-medium">
              {meetsDemand
                ? `${vehiclesNeeded} ${vehiclesNeeded === 1 ? "vehicle" : "vehicles"} covers ${formatNumber(passengerCount)} passengers`
                : `Short by ${formatNumber(Math.max(passengerCount - seatsAvailable, 0))} seats`}
            </p>
            <p className="tabular text-muted-foreground">
              {formatNumber(seatsAvailable)} seats available across{" "}
              {availableVehicles.length}{" "}
              {availableVehicles.length === 1 ? "vehicle" : "vehicles"} ·{" "}
              {availableDrivers.length}{" "}
              {availableDrivers.length === 1 ? "driver" : "drivers"} free
            </p>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vehicles in your fleet yet. Add coaches so availability can be
            checked against real capacity.
          </p>
        ) : (
          <div className="space-y-2">
            {availableVehicles.map(({ vehicle, typeName }) => (
              <div
                key={vehicle.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5"
              >
                <BusFront className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{vehicle.name}</p>
                  <p className="tabular truncate text-xs text-muted-foreground">
                    {typeName ? `${typeName} · ` : ""}
                    {vehicle.capacity} seats · {vehicle.registration_number}
                  </p>
                </div>
                <Badge variant="success">Available</Badge>
              </div>
            ))}

            {unavailableVehicles.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none py-1.5 text-sm text-muted-foreground hover:text-foreground">
                  {unavailableVehicles.length} unavailable
                  <span className="ml-1 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <div className="mt-2 space-y-2">
                  {unavailableVehicles.map(({ vehicle, reason }) => (
                    <div
                      key={vehicle.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"
                    >
                      <BusFront
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-muted-foreground">
                          {vehicle.name}
                        </p>
                        <p className="tabular truncate text-xs text-muted-foreground">
                          {vehicle.capacity} seats
                        </p>
                      </div>
                      <Badge variant="muted">{reason}</Badge>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {drivers.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Drivers free
            </p>
            {availableDrivers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No drivers are free across these dates.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {availableDrivers.map(({ driver }) => (
                  <li
                    key={driver.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm"
                  >
                    <UserSquare
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    {[driver.first_name, driver.last_name].filter(Boolean).join(" ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
