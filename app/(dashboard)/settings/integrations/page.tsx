import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  ExternalLink,
  Inbox,
  Link2,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { CopyBlock } from "@/components/settings/copy-block";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = { title: "Integrations" };

/** Mirrors lib/validations/public-request.ts exactly. */
const FIELDS = [
  {
    field: "Your name",
    name: "contact_name",
    required: true,
    rule: "2–120 characters",
    note: "Who the operator replies to.",
  },
  {
    field: "Email",
    name: "contact_email",
    required: true,
    rule: "Valid email address",
    note: "The only way to send the quote back.",
  },
  {
    field: "Phone",
    name: "contact_phone",
    required: false,
    rule: "Up to 32 characters",
    note: "Any format — not validated. +1 416 555 0134 reads well.",
  },
  {
    field: "Pickup",
    name: "pickup_location",
    required: true,
    rule: "2–160 characters",
    note: "City or landmark. Also sets the province the GST/HST is charged at.",
  },
  {
    field: "Pickup address",
    name: "pickup_address",
    required: false,
    rule: "Free text",
    note: "Exact collection point.",
  },
  {
    field: "Destination",
    name: "destination",
    required: true,
    rule: "2–160 characters",
    note: "Where the coach is going.",
  },
  {
    field: "Drop-off address",
    name: "destination_address",
    required: false,
    rule: "Free text",
    note: "Exact arrival point.",
  },
  {
    field: "Departure",
    name: "departure_at",
    required: true,
    rule: "Date and time",
    note: "Read in your organization's time zone.",
  },
  {
    field: "Return",
    name: "return_at",
    required: false,
    rule: "Must be after departure",
    note: "Blank means one way.",
  },
  {
    field: "Passengers",
    name: "passenger_count",
    required: true,
    rule: "Whole number, 1–5000",
    note: "Drives the vehicle count when you quote.",
  },
  {
    field: "Anything we should know",
    name: "special_requirements",
    required: false,
    rule: "Up to 2000 characters",
    note: "Accessibility, luggage, winter tires, border crossing.",
  },
] as const;

export default async function ApiIntegrationsPage() {
  const { organization } = await requireSession();

  const base = siteUrl();
  const url = `${base}/book/${organization.slug}`;
  const isLocal = /localhost|127\.0\.0\.1/.test(base);

  const plainLink = `<a href="${url}">Request a quote</a>`;

  const styledButton = `<a
  href="${url}"
  style="display:inline-block;padding:14px 28px;border-radius:9999px;
         background:#202020;color:#ffffff;font-weight:700;
         font-family:system-ui,sans-serif;font-size:15px;
         text-decoration:none;"
>
  Request a quote
</a>`;

  const iframeEmbed = `<iframe
  src="${url}"
  title="Request a quote from ${organization.name}"
  style="width:100%;height:1100px;border:0;"
  loading="lazy"
></iframe>`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="API &amp; integrations"
        title="Connect Busify to your website"
        description="One public link that turns an enquiry into a trip request on your board, with the customer's details already filled in. No login, no plugin, nothing to install."
      />

      {isLocal && (
        <Alert variant="warning">
          <CircleAlert />
          <AlertDescription>
            <p className="font-semibold text-ink">
              This link only works on your own computer right now.
            </p>
            <p>
              It points at <code className="font-mono">{base}</code>, which nobody
              else can reach. Before putting it on a real website, deploy Busify
              and set <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> to
              your live address — the link on this page updates automatically.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* --- The link ------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Step 1 · Your link</CardTitle>
            <CardDescription>
              Anyone who opens this sees a form branded with your company name,
              phone and city.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open it
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2.5 rounded-xl border border-bone bg-mist px-4 py-3">
            <Link2 className="size-4 shrink-0 text-ash" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-carbon">
              {url}
            </span>
          </div>
          <p className="mt-3 text-body-sm text-slate">
            The address is built from your organization&rsquo;s slug (
            <code className="font-mono text-[13px]">{organization.slug}</code>).
            Renaming your company in settings does not change it, so links you
            have already shared keep working.
          </p>
        </CardContent>
      </Card>

      {/* --- Putting it on a website --------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Step 2 · Put it on your website</CardTitle>
            <CardDescription>
              Three ways, easiest first. Paste into your site builder&rsquo;s HTML
              or embed block — Wix, Squarespace, WordPress and Webflow all have one.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="default">Simplest</Badge>
              <p className="text-body-sm font-semibold text-ink">A plain link</p>
            </div>
            <p className="mb-3 text-body-sm text-slate">
              Works everywhere, including email signatures and WhatsApp. Your site
              styles it like any other link.
            </p>
            <CopyBlock code={plainLink} label="HTML" />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="brand">Recommended</Badge>
              <p className="text-body-sm font-semibold text-ink">A styled button</p>
            </div>
            <p className="mb-3 text-body-sm text-slate">
              Self-contained inline styles, so it looks the same regardless of your
              site&rsquo;s CSS. Change{" "}
              <code className="font-mono text-[13px]">background</code> to match
              your brand.
            </p>
            <CopyBlock code={styledButton} label="HTML" />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">Advanced</Badge>
              <p className="text-body-sm font-semibold text-ink">
                Embedded in the page
              </p>
            </div>
            <p className="mb-3 text-body-sm text-slate">
              Keeps the customer on your own site. Needs a tall container — the form
              is long, and an iframe cannot resize itself. Increase{" "}
              <code className="font-mono text-[13px]">height</code> if it scrolls
              awkwardly on mobile.
            </p>
            <CopyBlock code={iframeEmbed} label="HTML" />
          </div>
        </CardContent>
      </Card>

      {/* --- What it collects ---------------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Step 3 · What the form asks for</CardTitle>
            <CardDescription>
              You do not build this form — it is hosted for you. This is what a
              customer fills in, and what lands on your board.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-7">Field</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Accepts</TableHead>
                <TableHead className="pr-7">Why it matters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELDS.map((row) => (
                <TableRow key={row.name}>
                  <TableCell className="pl-7">
                    <span className="block text-body-sm font-semibold text-ink">
                      {row.field}
                    </span>
                    <span className="block font-mono text-[11px] text-ash">
                      {row.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    {row.required ? (
                      <Badge variant="destructive">Required</Badge>
                    ) : (
                      <Badge variant="muted">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px]">{row.rule}</TableCell>
                  <TableCell className="pr-7 text-[13px]">{row.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* --- What happens next --------------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Step 4 · What happens after they send it</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {[
              [
                "It appears in Trip requests",
                "Status New, source Hosted booking page, contact details already filled in. Nothing is booked or priced.",
              ],
              [
                "You check availability",
                "The request page shows which coaches and drivers are actually free on those exact dates.",
              ],
              [
                "You quote or accept",
                "Create quote sends a price the customer can accept online. Accept & schedule puts it straight on the board for phone bookings.",
              ],
              [
                "Nothing is emailed automatically",
                "Busify does not yet send mail. You reply from the request page, or copy the quote link and send it yourself.",
              ],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-signal-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-body-sm text-pretty text-slate">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-bone pt-5">
            <Button asChild>
              <Link href="/trip-requests">
                <Inbox />
                Open trip requests
                <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                Send yourself a test request
                <ExternalLink />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* --- What does not exist yet ---------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Programmatic API</CardTitle>
            <CardDescription>
              Said plainly so you do not go looking for something that is not
              there yet.
            </CardDescription>
          </div>
          <Badge variant="muted">Not available</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body-sm text-pretty text-slate">
            There is <span className="font-semibold text-ink">no REST endpoint</span>{" "}
            and no API key to issue. The hosted page above is the supported way to
            take requests from outside Busify, and everything on this page works
            without writing any code.
          </p>

          <div className="rounded-xl border border-bone bg-mist p-4">
            <p className="meta-label">Why not</p>
            <p className="mt-2 text-body-sm text-pretty text-slate">
              A public write endpoint needs API keys that can be issued, rotated
              and revoked per organization, and stored hashed. That is a real piece
              of work rather than a route handler, and shipping a half-built
              version would be worse than not having one.
            </p>
          </div>

          <div>
            <p className="mb-2.5 text-body-sm font-semibold text-ink">
              Planned for a later phase
            </p>
            <ul className="space-y-2 text-body-sm text-slate">
              {[
                "A keyed POST endpoint for creating trip requests from your own backend.",
                "An embeddable JavaScript widget that keeps customers on your site instead of an iframe.",
                "Webhooks so your systems hear about accepted quotes and dispatched trips.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-cloud"
                  />
                  <span className="text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-ash text-pretty">
            The database already records where a request came from — dashboard,
            hosted page, API or AI — so requests created this way will be
            distinguishable from day one.
          </p>
        </CardContent>
      </Card>

      {/* --- Safety --------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Is it safe to make public?</CardTitle>
            <CardDescription>
              The page is open to anyone, so it is built to give nothing away.
            </CardDescription>
          </div>
          <ShieldCheck className="size-5 shrink-0 text-teal-600" aria-hidden />
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-body-sm text-slate">
            {[
              [
                "It can only ever create a request.",
                "Submissions cannot read, edit or delete anything — not your fleet, not your customers, not other requests.",
              ],
              [
                "Which organization it belongs to is decided on the server.",
                "It comes from the address, never from anything the browser sends, so a submission cannot be redirected to another company.",
              ],
              [
                "Only your public details are shown.",
                "Company name, city, phone and email. Your address, fleet, rates and team are never exposed.",
              ],
              [
                "Basic spam handling is built in.",
                "A hidden trap field catches simple bots, and repeat submissions from one email are limited. Heavy abuse would still need a proper firewall rule.",
              ],
              [
                "It is hidden from search engines.",
                "The page is marked noindex, so it will not turn up in Google.",
              ],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-500"
                />
                <span className="text-pretty">
                  <span className="font-semibold text-ink">{title}</span> {body}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
