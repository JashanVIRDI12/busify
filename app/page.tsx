import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Check } from "lucide-react";

import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";

// Reads the session to bounce signed-in operators straight to the dashboard.
export const dynamic = "force-dynamic";

const BENEFITS = [
  ["Stop losing enquiries.", "Every request lands in one queue with the dates and passenger count already filled in."],
  ["Quote in seconds, not evenings.", "Prices come from your own per-kilometre rates, with GST or HST applied at the right provincial rate."],
  ["Know what is free before you promise it.", "Availability is checked against real coaches, drivers and existing trips."],
] as const;

const TAGS = ["Requests", "Quotes", "Bookings", "Dispatch", "Fleet", "Drivers"] as const;

/** Miniature of the real product, drawn in markup — the brand shows the tool. */
function ProductPreview() {
  const rows = [
    { ref: "TR-00014", route: "Toronto → Niagara Falls", pax: 56, status: "New", tone: "bg-interactive/12 text-interactive" },
    { ref: "TR-00013", route: "Ottawa → Mont-Tremblant", pax: 42, status: "Quoted", tone: "bg-interactive/12 text-interactive" },
    { ref: "TR-00012", route: "Mississauga → Blue Mountain", pax: 90, status: "Needs info", tone: "bg-amber/18 text-[#8a4b12]" },
    { ref: "TR-00011", route: "Hamilton → Collingwood", pax: 24, status: "Accepted", tone: "bg-mint text-[#065f46]" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-bone bg-signal-white shadow-(--shadow-layered)">
      <div className="flex items-center gap-2 border-b border-bone px-5 py-3.5">
        <span className="size-2.5 rounded-full bg-cloud" />
        <span className="size-2.5 rounded-full bg-cloud" />
        <span className="size-2.5 rounded-full bg-cloud" />
        <p className="ml-2 text-[12px] font-semibold text-slate">Trip requests</p>
        <span className="ml-auto rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-signal-white">
          4 new
        </span>
      </div>

      <ul className="divide-y divide-bone">
        {rows.map((row) => (
          <li key={row.ref} className="flex items-center gap-3 px-5 py-3.5">
            <span className="tabular hidden w-20 shrink-0 font-mono text-[10px] tracking-wide text-ash sm:block">
              {row.ref}
            </span>
            <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">
              {row.route}
            </span>
            <span className="tabular hidden shrink-0 text-[12px] text-slate sm:block">
              {row.pax} pax
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-bold ${row.tone}`}
            >
              {row.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3 border-t border-bone bg-mist px-5 py-3.5">
        <div className="flex -space-x-2">
          {["RK", "SY", "IS"].map((initials) => (
            <span
              key={initials}
              className="flex size-7 items-center justify-center rounded-full bg-plaster text-[10px] font-bold text-carbon ring-2 ring-mist"
            >
              {initials}
            </span>
          ))}
        </div>
        <p className="text-[12px] text-slate">3 drivers free this week</p>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-dvh bg-signal-white">
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-6">
        {/* Two-column split: typographic claim left, real product right. */}
        <section className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="settle-1">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand">
              For Canadian charter &amp; motorcoach operators
            </span>

            <h1 className="mt-6 font-display text-[42px] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance text-onyx sm:text-[56px] lg:text-[64px]">
              Run the whole charter,
              <br className="hidden sm:block" /> not five spreadsheets.
            </h1>

            <ul className="mt-8 space-y-3">
              {BENEFITS.map(([lead, rest]) => (
                <li key={lead} className="flex gap-3">
                  <Check
                    className="mt-0.5 size-[18px] shrink-0 text-interactive"
                    strokeWidth={3}
                    aria-hidden
                  />
                  <p className="text-body-sm text-pretty text-slate">
                    <span className="font-bold text-ink">{lead}</span> {rest}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get started. It&rsquo;s free!
                  <ArrowUpRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-bone px-3.5 py-1.5 text-[12px] font-bold text-carbon"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="settle-2">
            <ProductPreview />
          </div>
        </section>

        {/* Tonal band breaks the white rhythm. */}
        <section className="settle-3 mb-20 rounded-2xl bg-plaster px-8 py-14 sm:px-14">
          <p className="meta-label text-center">Built the way Canadian operators work</p>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              ["One queue", "Requests from your website, phone and email land in the same place."],
              ["Built for the CRA", "GST, HST and QST by province, on the rate where the trip starts. Your registration number on every quote."],
              ["Isolated by database", "Row level security scopes every record to your organization."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-display text-subheading font-extrabold tracking-[-0.03em] text-onyx">
                  {title}
                </h3>
                <p className="mt-2 text-body-sm text-pretty text-slate">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-bone">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <Logo />
          <p className="text-[12px] text-ash">
            Busify AI — Canadian charter operations, run properly.
          </p>
        </div>
      </footer>
    </div>
  );
}
