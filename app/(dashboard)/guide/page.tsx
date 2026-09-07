import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BusFront,
  Code2,
  FileText,
  Inbox,
  Route,
  Sparkles,
  TicketCheck,
  UserSquare,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import type { OrgRole } from "@/types/database";

export const metadata: Metadata = { title: "How VIABUS works" };

const LIFECYCLE = [
  {
    icon: Inbox,
    title: "A request arrives",
    body: "Someone wants a coach. It lands in Trip requests as New — from your booking link, logged by you, or created by the assistant.",
    href: "/trip-requests",
    action: "Trip requests",
  },
  {
    icon: BusFront,
    title: "You check what is free",
    body: "The request page shows which coaches and drivers are genuinely available on those exact dates, and whether they seat the party.",
  },
  {
    icon: FileText,
    title: "You quote — or just accept",
    body: "Create quote sends a price the customer accepts online, with GST or HST at the right provincial rate. Accept & schedule skips that for phone bookings and repeat customers.",
    href: "/quotes",
    action: "Quotes",
  },
  {
    icon: TicketCheck,
    title: "A booking is created",
    body: "When a customer accepts their quote, the booking and the trip are created together. Deposit and balance are tracked from the quote.",
    href: "/bookings",
    action: "Bookings",
  },
  {
    icon: Route,
    title: "You dispatch it",
    body: "Assign a coach and driver, then move the trip through confirmed, dispatched, under way and completed. Completing releases the vehicle.",
    href: "/reservations",
    action: "Trips",
  },
] as const;

const INTAKE: { title: string; body: string; href?: string; action?: string }[] = [
  {
    title: "Log it yourself",
    body: "Trip requests → New request. Fastest when someone phones you.",
    href: "/trip-requests",
    action: "Open",
  },
  {
    title: "Your public booking link",
    body: "Share one link, or put a button on your website. Submissions arrive with contact details already filled in.",
    href: "/settings/api",
    action: "Set it up",
  },
  {
    title: "Ask the assistant",
    body: "Tell it the details in plain English. It prepares the request and you confirm it.",
  },
] as const;

const NOT_BUILT = [
  "Email — nothing is sent automatically. You share quote links yourself.",
  "Payments — deposits and balances are tracked, but nothing is collected.",
  "Calendar and analytics — the nav items are placeholders.",
  "Team invitations — roles and removal work, but there is no invite email yet.",
  "File uploads — logos, vehicle photos and driver documents have storage, but no upload screen.",
] as const;

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "DISPATCHER", "STAFF", "ACCOUNTANT", "DRIVER"];

export default async function GuidePage() {
  const { organization, role } = await requireSession();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guide"
        title="How VIABUS works"
        description={`Everything ${organization.name} can do today, in the order you will actually use it. Nothing here is aspirational — if it is on this page, it works.`}
      />

      {/* --- The whole thing in one line ----------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>The 30-second version</CardTitle>
            <CardDescription>
              One job moves left to right. Every screen in the sidebar is a stop
              along this line.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {["Request", "Availability", "Quote", "Booking", "Trip", "Dispatched"].map(
              (step, index, all) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-full bg-plaster px-3.5 py-1.5 text-body-sm font-bold text-ink">
                    {step}
                  </span>
                  {index < all.length - 1 && (
                    <ArrowRight className="size-4 shrink-0 text-cloud" aria-hidden />
                  )}
                </span>
              ),
            )}
          </div>
          <p className="mt-4 text-body-sm text-pretty text-slate">
            A request never becomes a booking on its own — you decide at every
            step. That is deliberate.
          </p>
        </CardContent>
      </Card>

      {/* --- Before anything works ----------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Start here · set up your fleet</CardTitle>
            <CardDescription>
              Availability and pricing both read from these. Skip them and the
              product will honestly tell you it cannot answer.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="divide-y divide-bone border-t border-bone">
            {[
              {
                icon: BusFront,
                title: "Vehicle types",
                body: "Classes like Highway Coach. Rates live here — base, per kilometre, per hour, in CAD — and quoting is calculated from them. Without rates, quotes cannot be priced.",
                href: "/vehicles/types",
              },
              {
                icon: BusFront,
                title: "Vehicles",
                body: "Your actual coaches, with seat counts. Availability checks against these. Anything marked Inactive or in Maintenance is excluded.",
                href: "/vehicles",
              },
              {
                icon: UserSquare,
                title: "Drivers",
                body: "Your roster, with licence class and air brake endorsement. Licence expiry drives the compliance warnings on your dashboard.",
                href: "/drivers",
              },
              {
                icon: Users,
                title: "Customers",
                body: "Who you quote and invoice. Optional — an enquiry from a stranger works without one.",
                href: "/customers",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex items-start gap-4 py-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-signal-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-body-sm text-pretty text-slate">{step.body}</p>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <Link href={step.href}>
                    Open
                    <ArrowRight />
                  </Link>
                </Button>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* --- The lifecycle -------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>The working day</CardTitle>
            <CardDescription>What happens to one job, start to finish.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="divide-y divide-bone border-t border-bone">
            {LIFECYCLE.map(({ icon: Icon, title, body, ...rest }, index) => (
              <li key={title} className="flex items-start gap-4 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mist text-slate">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-semibold text-ink">
                    <span className="mr-2 font-mono text-[11px] text-ash">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {title}
                  </p>
                  <p className="mt-1 text-body-sm text-pretty text-slate">{body}</p>
                </div>
                {"href" in rest && rest.href && (
                  <Button variant="ghost" size="sm" asChild className="shrink-0">
                    <Link href={rest.href}>
                      {rest.action}
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* --- Getting work in ------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Three ways work comes in</CardTitle>
              <CardDescription>All three land in the same queue.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {INTAKE.map((item) => (
              <div key={item.title} className="rounded-xl border border-bone p-4">
                <p className="text-body-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-body-sm text-pretty text-slate">{item.body}</p>
                {item.href && (
                  <Button variant="outline" size="sm" asChild className="mt-3">
                    <Link href={item.href}>
                      {item.action}
                      <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>The assistant</CardTitle>
              <CardDescription>
                Bottom-right of every page. It reads your live data and never
                guesses.
              </CardDescription>
            </div>
            <Sparkles className="size-5 shrink-0 text-brand" aria-hidden />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-body-sm font-semibold text-ink">Try asking</p>
              <ul className="space-y-2">
                {[
                  "Brief me on today",
                  "Which coaches are free this Friday for 40 passengers?",
                  "Show trips without a driver",
                  "Accept TR-00002 and put it on the schedule",
                ].map((q) => (
                  <li
                    key={q}
                    className="rounded-full bg-mist px-3.5 py-2 font-mono text-[12px] text-carbon"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-bone bg-mist p-4">
              <p className="meta-label">It asks before it acts</p>
              <p className="mt-2 text-body-sm text-pretty text-slate">
                When it wants to change something it shows a confirmation card
                first. Nothing happens until you click Confirm. It cannot delete
                anything, issue refunds, or email anyone.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* --- Roles ---------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Who can do what</CardTitle>
            <CardDescription>
              Roles are enforced by the database, not just hidden in the
              interface. You are {ROLE_LABELS[role]}.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-bone border-t border-bone">
            {ROLES.map((entry) => (
              <li key={entry} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <span className="flex w-28 shrink-0 items-center gap-2">
                  <span className="text-body-sm font-semibold text-ink">
                    {ROLE_LABELS[entry]}
                  </span>
                  {entry === role && <Badge variant="brand">You</Badge>}
                </span>
                <span className="min-w-0 flex-1 text-body-sm text-pretty text-slate">
                  {ROLE_DESCRIPTIONS[entry]}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* --- Honest gaps ---------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>What is not built yet</CardTitle>
            <CardDescription>
              So you do not go looking for something that is not there.
            </CardDescription>
          </div>
          <Badge variant="muted">Later phases</Badge>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {NOT_BUILT.map((item) => (
              <li key={item} className="flex gap-3 text-body-sm text-slate">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-cloud" />
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-bone pt-5">
            <Button asChild>
              <Link href="/trip-requests">
                <Inbox />
                Start with a request
                <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings/api">
                <Code2 />
                Set up your booking link
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
