import type { Metadata } from "next";

import {
  AvailabilityManager,
  type Window,
} from "@/components/driver/availability-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireDriver } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";
import { getOwnAvailability } from "@/lib/queries/driver";

export const metadata: Metadata = { title: "My schedule" };

export default async function DriverSchedulePage() {
  const { organization } = await requireDriver();
  const timeZone = organization.timezone;

  const windows: Window[] = (await getOwnAvailability())
    .filter((w) => !w.is_available)
    .map((w) => ({
      id: w.id,
      starts_at: w.starts_at,
      ends_at: w.ends_at,
      reason: w.reason,
      label: `${formatDateTime(w.starts_at, timeZone)} — ${formatDateTime(
        w.ends_at,
        timeZone,
      )}`,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My schedule"
        description="Block off time you're not available. Dispatch sees this when assigning trips."
      />
      <AvailabilityManager windows={windows} />
    </div>
  );
}
