import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { DriverStatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireDriver } from "@/lib/auth/session";
import { DRIVER_LICENCE_CLASSES } from "@/lib/constants";

export const metadata: Metadata = { title: "My profile" };

const CLASS_LABELS = Object.fromEntries(
  DRIVER_LICENCE_CLASSES.map((c) => [c.value, c.label]),
);

function formatDay(value: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function DriverProfilePage() {
  const { driver, organization, user } = await requireDriver();

  const rows: [string, React.ReactNode][] = [
    ["Name", [driver.first_name, driver.last_name].filter(Boolean).join(" ")],
    ["Email", user.email ?? "—"],
    ["Phone", driver.phone ?? "—"],
    ["Operator", organization.name],
    ["Status", <DriverStatusBadge key="s" status={driver.status} />],
    ["Licence number", driver.license_number ?? "—"],
    [
      "Licence class",
      driver.license_class
        ? (CLASS_LABELS[driver.license_class] ?? driver.license_class)
        : "—",
    ],
    [
      "Air brake endorsement",
      driver.air_brake_endorsement ? "Yes" : "Not recorded",
    ],
    ["Licence expires", formatDay(driver.license_expires_on)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="What your operator has on record. Ask a dispatcher to correct anything that's wrong."
      />

      <Card>
        <CardContent className="divide-y divide-bone">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 text-body-sm"
            >
              <span className="text-ash">{label}</span>
              <span className="text-right font-medium text-ink">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-body-sm text-ash">
        To change your password, sign out and use “Forgot password?” on the
        driver sign-in page.
      </p>
    </div>
  );
}
