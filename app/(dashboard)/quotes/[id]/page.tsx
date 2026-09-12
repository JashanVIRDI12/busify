import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuoteBuilder } from "@/components/quotes/builder/quote-builder";
import type { CustomerHit } from "@/app/(dashboard)/quotes/builder-actions";
import { requireSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { canWriteFinance } from "@/lib/permissions";
import { getBuilderLookups } from "@/lib/queries/builder-lookups";
import { getQuoteForBuilder } from "@/lib/queries/quote-builder";
import { toBuilderState } from "@/lib/quotes/builder-model";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getQuoteForBuilder(id);
  return {
    title: data ? data.quote.quote_number ?? data.quote.title : "Quote",
  };
}

function customerHit(
  row:
    | {
        id: string;
        first_name: string;
        last_name: string | null;
        company: string | null;
        email: string | null;
        phone: string | null;
      }
    | null,
): CustomerHit | null {
  if (!row) return null;
  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || "Unnamed",
    company: row.company,
    email: row.email,
    phone: row.phone,
  };
}

export default async function QuoteBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization, role } = await requireSession();

  const data = await getQuoteForBuilder(id);
  if (!data) notFound();

  const supabase = await createClient();
  const { lookups } = await getBuilderLookups(organization);

  const { data: files } = await supabase
    .from("quote_files")
    .select("id, name, size_bytes")
    .eq("quote_id", id)
    .order("created_at", { ascending: true });

  return (
    <QuoteBuilder
      initialState={toBuilderState(data)}
      lookups={lookups}
      currency={organization.currency}
      timezone={organization.timezone}
      canEdit={canWriteFinance(role)}
      quoteNumber={data.quote.quote_number}
      publicUrl={`${siteUrl()}/quote/${data.quote.public_token}`}
      organizationId={organization.id}
      createdAt={data.quote.created_at}
      updatedAt={data.quote.updated_at}
      files={files ?? []}
      initialCustomer={customerHit(data.customer)}
      initialBilling={customerHit(data.billingCustomer)}
    />
  );
}
