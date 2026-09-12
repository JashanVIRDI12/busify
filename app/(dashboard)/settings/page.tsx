import type { Metadata } from "next";

import { PageTabs } from "@/components/data/page-tabs";
import { BrandingForm } from "@/components/settings/branding-form";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { DefaultsForm } from "@/components/settings/defaults-form";
import { TermsPanel } from "@/components/settings/terms-panel";
import { requireSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { getOrganizationSettings } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "General settings" };

const TABS = ["profile", "defaults", "branding", "terms"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  profile: "Company Profile",
  defaults: "Defaults",
  branding: "Branding",
  terms: "Terms",
};

export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;

  const tab: Tab = TABS.includes(resolved.tab as Tab)
    ? (resolved.tab as Tab)
    : "profile";

  const canEdit = canManage(role);

  const tabs = TABS.map((key) => ({
    key,
    label: TAB_LABELS[key],
    href: key === "profile" ? "/settings" : `/settings?tab=${key}`,
  }));

  return (
    <>
      <h1 className="mb-4 text-heading-sm font-semibold text-ink">General</h1>
      <PageTabs tabs={tabs} active={tab} />

      {tab === "profile" && (
        <CompanyProfileForm organization={organization} canEdit={canEdit} />
      )}
      {tab === "defaults" && <DefaultsTab canEdit={canEdit} slug={organization.slug} />}
      {tab === "branding" && (
        <BrandingForm organization={organization} canEdit={canEdit} />
      )}
      {tab === "terms" && <TermsTab canEdit={canEdit} subtab={resolved.subtab} />}
    </>
  );
}

async function DefaultsTab({
  canEdit,
  slug,
}: {
  canEdit: boolean;
  slug: string;
}) {
  const supabase = await createClient();

  const [settings, { data: garages }, { data: types }] = await Promise.all([
    getOrganizationSettings(),
    supabase.from("garages").select("id, name").order("name").limit(200),
    supabase.from("vehicle_types").select("name").order("name").limit(100),
  ]);

  return (
    <DefaultsForm
      settings={settings}
      garages={garages ?? []}
      vehicleTypes={(types ?? []).map((type) => type.name)}
      widgetUrl={`${siteUrl()}/book/${slug}`}
      canEdit={canEdit}
    />
  );
}

async function TermsTab({
  canEdit,
  subtab,
}: {
  canEdit: boolean;
  subtab: string | string[] | undefined;
}) {
  const kind = subtab === "quote" ? "QUOTE" : "CONTRACT";

  const supabase = await createClient();
  const { data } = await supabase
    .from("contract_terms")
    .select("*")
    .eq("kind", kind)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  return (
    <>
      <PageTabs
        tabs={[
          {
            key: "CONTRACT",
            label: "Contract Terms",
            href: "/settings?tab=terms",
          },
          {
            key: "QUOTE",
            label: "Quote Terms",
            href: "/settings?tab=terms&subtab=quote",
          },
        ]}
        active={kind}
      />

      <TermsPanel kind={kind} terms={data ?? []} canEdit={canEdit} />
    </>
  );
}
