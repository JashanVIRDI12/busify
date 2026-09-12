import type { Metadata } from "next";

import { PageTabs } from "@/components/data/page-tabs";
import { TemplateCard } from "@/components/settings/template-card";
import { requireSession } from "@/lib/auth/session";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;
  const tab = resolved.tab === "invoice" ? "invoice" : "quote";

  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("*");

  const byKind = new Map((data ?? []).map((row) => [row.kind, row]));
  const canEdit = canManage(role);

  // Only addresses the operator has already told us about: a From that is not
  // theirs would be rejected by the mail provider anyway.
  const fromOptions = [organization.email, organization.bcc_email].filter(
    (address): address is string => Boolean(address),
  );

  const tabs = [
    { key: "quote", label: "Quote", href: "/settings/templates" },
    { key: "invoice", label: "Invoice", href: "/settings/templates?tab=invoice" },
  ];

  return (
    <>
      <h1 className="mb-4 text-heading-sm font-semibold text-ink">Templates</h1>
      <PageTabs tabs={tabs} active={tab} />

      {tab === "quote" ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <TemplateCard
            kind="QUOTE_BOOKING"
            title="Quote Booking Email Template"
            hint="Sent when you send a quote the customer can book and pay for online."
            template={byKind.get("QUOTE_BOOKING")}
            fromOptions={fromOptions}
            canEdit={canEdit}
          />
          <TemplateCard
            kind="QUOTE_REQUEST"
            title="Quote Request Email Template"
            hint="Sent in reply to an enquiry, before the quote is bookable."
            template={byKind.get("QUOTE_REQUEST")}
            fromOptions={fromOptions}
            canEdit={canEdit}
          />
        </div>
      ) : (
        <div className="max-w-2xl">
          <TemplateCard
            kind="INVOICE"
            title="Invoice Email Template"
            hint="Sent with an invoice for a confirmed reservation."
            template={byKind.get("INVOICE")}
            fromOptions={fromOptions}
            canEdit={canEdit}
          />
        </div>
      )}
    </>
  );
}
