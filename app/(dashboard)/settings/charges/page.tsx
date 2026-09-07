import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import {
  deleteCustomChargesAction,
  saveCustomChargeAction,
} from "@/app/(dashboard)/settings/catalog-actions";
import { SearchField, SingleFilter, FilterBar } from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import { PageTabs } from "@/components/data/page-tabs";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import {
  DataTable,
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableCard,
} from "@/components/data/table";
import { TablePagination } from "@/components/data/table-pagination";
import { RecordDrawer, type FieldSpec } from "@/components/settings/record-drawer";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import {
  filterValue,
  ilikeAcross,
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { ChargeCategory } from "@/types/database";

export const metadata: Metadata = { title: "Custom Charges" };

const TABS: { key: ChargeCategory; label: string; noun: string; heading: string }[] =
  [
    { key: "CHARGE", label: "Custom Charges", noun: "Charge", heading: "Charges" },
    { key: "MARKUP", label: "Markups", noun: "Markup", heading: "Markups" },
    { key: "TAX", label: "Taxes", noun: "Tax", heading: "Taxes" },
  ];

const RATE_TYPES = [
  { value: "FLAT", label: "Flat Rate" },
  { value: "PER_QUANTITY", label: "Per Quantity" },
  { value: "PERCENTAGE", label: "Percentage" },
];

const PLACEMENTS = [
  { value: "ITEMIZED", label: "Itemized Charge" },
  { value: "BASE_FARE", label: "Rolled into Base Fare" },
];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default async function CustomChargesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, organization } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);
  const currency = organization.currency;

  const active =
    TABS.find((tab) => tab.key === resolved.tab) ?? TABS[0]!;

  const supabase = await createClient();

  let query = supabase
    .from("custom_charges")
    .select("*", { count: "exact" })
    .eq("category", active.key)
    .order("position", { ascending: true })
    .order("name", { ascending: true })
    .range(params.from, params.to);

  if (params.q) query = query.or(ilikeAcross(["name"], params.q));

  const exempt = filterValue(params, "exempt");
  if (exempt === "yes" || exempt === "no") {
    query = query.eq("tax_exempt", exempt === "yes");
  }

  const isDefault = filterValue(params, "default");
  if (isDefault === "yes" || isDefault === "no") {
    query = query.eq("default_on_quote", isDefault === "yes");
  }

  const { data, count } = await query;
  const rows = data ?? [];
  const total = count ?? 0;
  const manageAllowed = canManage(role);

  const fields: FieldSpec[] = [
    { kind: "hidden", name: "category", value: active.key },
    { kind: "text", name: "name", label: "Name", required: true },
    { kind: "select", name: "rate_type", label: "Type", options: RATE_TYPES, half: true },
    { kind: "money", name: "rate", label: "Rate", half: true },
    { kind: "select", name: "placement", label: "Placement", options: PLACEMENTS },
    {
      kind: "toggle",
      name: "tax_exempt",
      label: "Tax exempt",
      description: "Excluded from the sales tax calculation on a quote.",
    },
    {
      kind: "toggle",
      name: "default_on_quote",
      label: "Add to every new quote",
      description: "Applied automatically, and removable per quote.",
    },
    { kind: "textarea", name: "note", label: "Note shown to the customer", rows: 3 },
  ];

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <h1 className="mb-4 text-heading-sm font-semibold text-ink">Custom Charges</h1>

      <PageTabs
        tabs={TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          href:
            tab.key === "CHARGE"
              ? "/settings/charges"
              : `/settings/charges?tab=${tab.key}`,
        }))}
        active={active.key}
      />

      <div className="panel p-4">
        <PageHeading
          title={active.heading}
          actions={
            manageAllowed ? (
              <RecordDrawer
                title={`Add ${active.noun}`}
                action={saveCustomChargeAction}
                fields={fields}
                submitLabel={`Add ${active.noun}`}
                trigger={
                  <Button>
                    <Plus />
                    Add {active.noun}
                  </Button>
                }
              />
            ) : null
          }
        />

        <FilterBar>
          <SearchField placeholder="Search" />
          <SingleFilter paramKey="exempt" label="Tax Exempt" options={YES_NO} />
          <SingleFilter paramKey="default" label="Default on Quote" options={YES_NO} />
        </FilterBar>

        <TableCard
          footer={
            <TablePagination
              page={params.page}
              pageCount={pageCount(total, params.per)}
              perPage={params.per}
            />
          }
        >
          <DataTable className="min-w-[60rem]">
            <THead>
              <TH width="44px">
                <SelectAllCheckbox />
              </TH>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Rate</TH>
              <TH>Placement</TH>
              <TH>Tax Exempt</TH>
              <TH>Default on Quote</TH>
            </THead>

            <TBody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={7} message="No data found" />
              ) : (
                rows.map((charge) => (
                  <TR key={charge.id}>
                    <TD>
                      <RowCheckbox id={charge.id} />
                    </TD>
                    <TD>
                      <Link
                        href={`/settings/charges?tab=${active.key}&edit=${charge.id}`}
                        scroll={false}
                        className="text-teal-600 hover:underline"
                      >
                        {charge.name}
                      </Link>
                    </TD>
                    <TD>
                      {RATE_TYPES.find((type) => type.value === charge.rate_type)
                        ?.label ?? charge.rate_type}
                    </TD>
                    <TD className="tabular">
                      {charge.rate_type === "PERCENTAGE"
                        ? `${Number(charge.rate)}%`
                        : formatMoney(charge.rate, currency, { precise: true })}
                    </TD>
                    <TD>
                      {PLACEMENTS.find((place) => place.value === charge.placement)
                        ?.label ?? charge.placement}
                    </TD>
                    <TD>{charge.tax_exempt ? "Yes" : "No"}</TD>
                    <TD className={charge.default_on_quote ? undefined : "text-slate"}>
                      {charge.default_on_quote ? "Default" : "Not Default"}
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </DataTable>
        </TableCard>
      </div>

      {editing && (
        <RecordDrawer
          key={editing.id}
          title={`Edit ${active.noun}`}
          action={saveCustomChargeAction}
          fields={[{ kind: "hidden", name: "id", value: editing.id }, ...fields]}
          values={editing}
          routed
        />
      )}

      <BulkActionBar
        noun={active.noun.toLowerCase()}
        canDelete={manageAllowed}
        onDelete={deleteCustomChargesAction}
      />
    </SelectionProvider>
  );
}
