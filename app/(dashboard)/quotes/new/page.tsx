import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuoteBuilder } from "@/components/quotes/builder/quote-builder";
import { requireSession } from "@/lib/auth/session";
import { canWriteFinance } from "@/lib/permissions";
import { getBuilderLookups } from "@/lib/queries/builder-lookups";
import { createClient } from "@/lib/supabase/server";
import { blankQuoteState } from "@/lib/quotes/builder-model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New Quote" };

/**
 * A quote that does not exist yet.
 *
 * "Add Quote" used to insert a row and redirect to it, so every stray click
 * left an empty Lead in the pipeline holding a quote number nobody would use.
 * Nothing here touches the database: the builder opens on an in-memory model
 * and the first save is what creates the quote and draws its number.
 */
export default async function NewQuotePage() {
  const { organization, role } = await requireSession();

  // Read-only roles have nothing to do on a blank quote, and saving would be
  // refused by the action anyway. Send them back rather than showing a form
  // whose Save button can never work.
  if (!canWriteFinance(role)) redirect("/quotes");

  const supabase = await createClient();
  const { lookups, settings } = await getBuilderLookups(organization);

  const [{ data: defaultTerms }, { data: standingCharges }] = await Promise.all([
    supabase
      .from("contract_terms")
      .select("id")
      .eq("kind", "CONTRACT")
      .eq("is_default", true)
      .maybeSingle(),
    supabase
      .from("custom_charges")
      .select("name, rate_type, rate, tax_exempt")
      .eq("category", "CHARGE")
      .eq("default_on_quote", true)
      .order("position")
      .limit(25),
  ]);

  const initialState = blankQuoteState({
    province: organization.state,
    gstNumber: organization.gst_hst_number,
    customerVisibility: settings.customer_visibility,
    contractTermsId: defaultTerms?.id ?? null,
    defaultGarageId: settings.default_garage_id,
    enableSalesTax: settings.enable_sales_tax !== false,
    standingCharges: (standingCharges ?? []).map((charge) => ({
      name: charge.name,
      rate_type: charge.rate_type,
      rate: Number(charge.rate),
      tax_exempt: charge.tax_exempt,
    })),
  });

  return (
    <QuoteBuilder
      initialState={initialState}
      lookups={lookups}
      currency={organization.currency}
      timezone={organization.timezone}
      canEdit
      // No number and no public link until it is saved — both are assigned by
      // the database when the row is finally created.
      quoteNumber={null}
      publicUrl=""
      organizationId={organization.id}
      createdAt={null}
      updatedAt={null}
      files={[]}
      initialCustomer={null}
      initialBilling={null}
    />
  );
}
