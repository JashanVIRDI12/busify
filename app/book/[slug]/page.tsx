import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";

import { PublicRequestForm } from "@/components/booking/public-request-form";
import { getPublicOrganization } from "@/lib/queries/public-org";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const organization = await getPublicOrganization(slug);

  if (!organization) return { title: "Booking page not found" };

  return {
    title: `Request a quote · ${organization.name}`,
    description: `Tell ${organization.name} about your trip and get a price back.`,
    // A quote page has no business appearing in search results.
    robots: { index: false, follow: false },
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getPublicOrganization(slug);
  if (!organization) notFound();

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className=" pointer-events-none absolute inset-x-0 top-0 h-72"
      />

      <main className="relative mx-auto w-full max-w-2xl px-6 py-14 sm:py-20">
        <header className="text-center">
          <p className="text-xs font-medium tracking-wide text-interactive uppercase">
            Charter enquiry
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance capitalize sm:text-4xl">
            {organization.name}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground text-pretty sm:text-base">
            Tell us where you are going and when. We will come back to you with a
            price for the coaches you need.
          </p>

          {(organization.phone || organization.email || organization.city) && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {organization.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  {organization.city}
                </span>
              )}
              {organization.phone && (
                <a
                  href={`tel:${organization.phone.replace(/\s+/g, "")}`}
                  className="tabular inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {organization.phone}
                </a>
              )}
              {organization.email && (
                <a
                  href={`mailto:${organization.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  {organization.email}
                </a>
              )}
            </div>
          )}
        </header>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-(--shadow-subtle) sm:p-8">
          <PublicRequestForm
            slug={organization.slug}
            companyName={organization.name}
            timeZone={organization.timezone}
          />
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          VIABUS
        </p>
      </main>
    </div>
  );
}
