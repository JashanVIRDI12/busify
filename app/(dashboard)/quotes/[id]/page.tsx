import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { QuoteBuilder } from "@/components/quotes/builder/quote-builder";
import type { BuilderLookups } from "@/components/quotes/builder/builder-context";
import type { CustomerHit } from "@/app/(dashboard)/quotes/builder-actions";
import { requireSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { canWriteFinance } from "@/lib/permissions";
import { getQuoteForBuilder } from "@/lib/queries/quote-builder";
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

  const [
    { data: garages },
    { data: contractTerms },
    { data: vehicleTypes },
    { data: vehicles },
    { data: members },
  ] = await Promise.all([
    supabase.from("garages").select("id, name, address").order("name"),
    supabase
      .from("contract_terms")
      .select("id, name, body, is_default")
      .order("name"),
    supabase
      .from("vehicle_types")
      .select(
        "id, name, default_capacity, base_rate, per_km_rate, per_hour_rate, per_day_rate",
      )
      .order("name"),
    supabase
      .from("vehicles")
      .select("id, name, capacity, vehicle_type_id")
      .order("name"),
    supabase.from("organization_members").select("user_id, role"),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberIds)
    : { data: [] };

  const lookups: BuilderLookups = {
    salesReps: (profiles ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name?.trim() || profile.email || "Teammate",
    })),
    garages: (garages ?? []).map((garage) => ({
      id: garage.id,
      name: garage.name,
      address: garage.address,
    })),
    contractTerms: contractTerms ?? [],
    vehicleTypes: (vehicleTypes ?? []).map((type) => ({
      id: type.id,
      name: type.name,
      default_capacity: type.default_capacity,
      base_rate: Number(type.base_rate),
      per_km_rate: Number(type.per_km_rate),
      per_hour_rate: Number(type.per_hour_rate),
      per_day_rate: Number(type.per_day_rate),
    })),
    vehicles: (vehicles ?? []).map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      capacity: vehicle.capacity,
      vehicle_type_id: vehicle.vehicle_type_id,
    })),
    province: organization.state,
    gstNumber: organization.gst_hst_number,
  };

  return (
    <QuoteBuilder
      data={data}
      lookups={lookups}
      currency={organization.currency}
      timezone={organization.timezone}
      canEdit={canWriteFinance(role)}
      quoteNumber={data.quote.quote_number}
      publicUrl={`${siteUrl()}/quote/${data.quote.public_token}`}
      createdAt={data.quote.created_at}
      initialCustomer={customerHit(data.customer)}
      initialBilling={customerHit(data.billingCustomer)}
    />
  );
}
