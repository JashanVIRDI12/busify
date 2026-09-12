import type { Metadata } from "next";
import { Suspense } from "react";
import {
  BusFront,
  CalendarClock,
  Inbox,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react";

import { WelcomeTour } from "@/components/guide/welcome-tour";
import { BreakdownCard } from "@/components/dashboard/breakdown-card";
import { MetricStrip, type Metric } from "@/components/dashboard/metric-strip";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { Skeleton } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/session";
import { getDashboardMetrics, type DashboardMetrics } from "@/lib/queries/dashboard";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

function greeting(timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * One honest sentence about the state of the business, rather than a generic
 * "here is your dashboard". It names the most pressing thing, or says plainly
 * that there isn't one.
 */
function situation(metrics: DashboardMetrics): string {
  const worst = metrics.attention[0];
  if (worst) return `${worst.count} ${worst.label} — ${worst.detail.toLowerCase()}`;

  if (!metrics.setup.isComplete) {
    const next = metrics.setup.steps.find((step) => !step.done);
    return next
      ? `Your board is quiet. ${next.description}`
      : "Your board is quiet.";
  }

  if (metrics.upcomingTrips > 0) {
    return `Nothing is overdue. ${formatNumber(metrics.upcomingTrips)} ${
      metrics.upcomingTrips === 1 ? "trip is" : "trips are"
    } on the schedule.`;
  }

  return "Nothing is overdue and nothing is waiting on you.";
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

async function Overview({
  currency,
  timeZone,
  firstName,
  organizationName,
}: {
  currency: string;
  timeZone: string;
  firstName: string | null;
  organizationName: string;
}) {
  const metrics = await getDashboardMetrics(currency);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const figures: Metric[] = [
    {
      label: "Revenue this month",
      value: formatMoney(metrics.revenueThisMonth, currency),
      hint: "Invoiced on reservations departing this month.",
      icon: TrendingUp,
      lead: true,
    },
    {
      label: "Pending requests",
      value: formatNumber(metrics.pendingRequests),
      hint: "New, in review, or awaiting the customer.",
      icon: Inbox,
      href: "/trip-requests",
    },
    {
      label: "Upcoming trips",
      value: formatNumber(metrics.upcomingTrips),
      hint: "Scheduled, confirmed or dispatched.",
      icon: CalendarClock,
      href: "/reservations",
    },
    {
      label: "New reservations",
      value: formatNumber(metrics.newReservations),
      hint: "Booked this month.",
      icon: TicketCheck,
      href: "/reservations",
    },
    {
      label: "Fleet utilization",
      value: `${metrics.fleet.utilization}%`,
      hint: `${metrics.fleet.total} ${metrics.fleet.total === 1 ? "vehicle" : "vehicles"} on the books.`,
      icon: BusFront,
      href: "/vehicles",
    },
    {
      label: "Customers",
      value: formatNumber(metrics.customers),
      hint: "Across every trip you have run.",
      icon: Users,
      href: "/contacts",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Editorial hero. Display type at exhibition scale, mono eyebrow, and
          one true sentence about where the business stands. */}
      <header className="settle-1">
        <p className="meta-label">
          {today} · {organizationName}
        </p>
        <h1 className="mt-3 font-display text-[38px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance text-onyx sm:text-[52px]">
          {greeting(timeZone)}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-4 max-w-2xl text-body text-pretty text-slate">
          {situation(metrics)}
        </p>
      </header>

      {!metrics.setup.isComplete && (
        <div className="settle-2">
          <SetupChecklist setup={metrics.setup} />
        </div>
      )}

      <div className="settle-3">
        <MetricStrip metrics={figures} />
      </div>

      {/* Attention leads; the breakdowns are reference material beside it. */}
      <div className="settle-4 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <NeedsAttention items={metrics.attention} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <BreakdownCard
            title="Fleet status"
            total={metrics.fleet.total}
            totalLabel="vehicles"
            emptyMessage="No vehicles yet. Add your first coach from the Fleet page."
            rows={[
              { label: "Available", value: metrics.fleet.byStatus.AVAILABLE, tone: "success" },
              { label: "Assigned", value: metrics.fleet.byStatus.ASSIGNED, tone: "primary" },
              { label: "In trip", value: metrics.fleet.byStatus.IN_TRIP, tone: "primary" },
              { label: "Maintenance", value: metrics.fleet.byStatus.MAINTENANCE, tone: "warning" },
              { label: "Inactive", value: metrics.fleet.byStatus.INACTIVE, tone: "muted" },
            ]}
          />
          <BreakdownCard
            title="Driver status"
            total={metrics.drivers.total}
            totalLabel="drivers"
            emptyMessage="No drivers yet. Add your team from the Drivers page."
            rows={[
              { label: "Active", value: metrics.drivers.byStatus.ACTIVE, tone: "success" },
              { label: "On trip", value: metrics.drivers.byStatus.ON_TRIP, tone: "primary" },
              { label: "Off duty", value: metrics.drivers.byStatus.OFF_DUTY, tone: "secondary" },
              { label: "On leave", value: metrics.drivers.byStatus.ON_LEAVE, tone: "warning" },
              { label: "Inactive", value: metrics.drivers.byStatus.INACTIVE, tone: "muted" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { user, organization } = await requireSession();

  const firstName =
    typeof user.user_metadata?.full_name === "string"
      ? (user.user_metadata.full_name.trim().split(/\s+/)[0] ?? null)
      : null;

  return (
    <>
      <WelcomeTour />
      <Suspense fallback={<OverviewSkeleton />}>
      <Overview
        currency={organization.currency}
        timeZone={organization.timezone}
        firstName={firstName}
        organizationName={organization.name}
      />
      </Suspense>
    </>
  );
}
