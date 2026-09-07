import type { Metadata } from "next";
import Link from "next/link";

import { PageTabs } from "@/components/data/page-tabs";
import { DriverPayForm } from "@/components/settings/driver-pay-form";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { getOrganizationSettings } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Driver Pay settings" };

export default async function DriverPaySettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;
  const tab = resolved.tab === "payroll" ? "payroll" : "options";

  const settings = await getOrganizationSettings();

  const tabs = [
    { key: "options", label: "Pay Options", href: "/settings/driver-pay" },
    { key: "payroll", label: "Payroll", href: "/settings/driver-pay?tab=payroll" },
  ];

  return (
    <>
      <h1 className="mb-4 text-heading-sm font-semibold text-ink">Driver Pay</h1>
      <PageTabs tabs={tabs} active={tab} />

      {tab === "options" ? (
        <DriverPayForm settings={settings} canEdit={canManage(role)} />
      ) : (
        <PayrollSummary currency={organization.currency} />
      )}
    </>
  );
}

/**
 * The Payroll tab reports rather than configures: what is outstanding, and what
 * has been paid. The working screen is /driver-pay — this is the answer to
 * "what do we owe drivers right now", which is a settings-desk question.
 */
async function PayrollSummary({ currency }: { currency: string }) {
  const supabase = await createClient();

  const { data: stubs } = await supabase
    .from("driver_pay_stubs")
    .select("status, total_pay")
    .limit(2000);

  const { data: entries } = await supabase
    .from("driver_pay_entries")
    .select("status, total_pay")
    .is("pay_stub_id", null)
    .limit(2000);

  const byStatus = new Map<string, { count: number; total: number }>();
  for (const stub of stubs ?? []) {
    const bucket = byStatus.get(stub.status) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += Number(stub.total_pay);
    byStatus.set(stub.status, bucket);
  }

  const unbilled = (entries ?? []).reduce(
    (sum, entry) => sum + Number(entry.total_pay),
    0,
  );

  const cards = [
    {
      label: "Not yet on a pay stub",
      value: formatMoney(unbilled, currency, { precise: true }),
      detail: `${entries?.length ?? 0} pay rows`,
    },
    {
      label: "Pending",
      value: formatMoney(byStatus.get("PENDING")?.total ?? 0, currency, {
        precise: true,
      }),
      detail: `${byStatus.get("PENDING")?.count ?? 0} stubs`,
    },
    {
      label: "Approved",
      value: formatMoney(byStatus.get("APPROVED")?.total ?? 0, currency, {
        precise: true,
      }),
      detail: `${byStatus.get("APPROVED")?.count ?? 0} stubs`,
    },
    {
      label: "Paid",
      value: formatMoney(byStatus.get("PAID")?.total ?? 0, currency, {
        precise: true,
      }),
      detail: `${byStatus.get("PAID")?.count ?? 0} stubs`,
    },
  ];

  return (
    <div className="panel p-5 sm:p-6">
      <h2 className="text-subheading font-semibold text-ink">Payroll</h2>
      <p className="mt-1 mb-5 text-body-sm text-slate">
        Where driver pay stands right now. Work the individual rows on the Driver
        Pay screen.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="panel-flat p-4">
            <p className="text-[12.5px] text-slate">{card.label}</p>
            <p className="tabular mt-1 text-subheading font-semibold text-ink">
              {card.value}
            </p>
            <p className="mt-0.5 text-[12px] text-ash">{card.detail}</p>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="mt-5" asChild>
        <Link href="/driver-pay">Open Driver Pay</Link>
      </Button>
    </div>
  );
}
