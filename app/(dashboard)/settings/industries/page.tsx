import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import {
  deleteIndustriesAction,
  saveIndustryAction,
} from "@/app/(dashboard)/settings/catalog-actions";
import { PageHeading } from "@/components/data/page-heading";
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
import { RecordDrawer } from "@/components/settings/record-drawer";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Industries" };

const FIELDS = [{ kind: "text" as const, name: "name", label: "Industry", required: true }];

export default async function IndustriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("industries")
    .select("*", { count: "exact" })
    .order("reference", { ascending: true });

  const rows = data ?? [];
  const manageAllowed = canManage(role);

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Industries"
        count={count ?? rows.length}
        actions={
          manageAllowed ? (
            <RecordDrawer
              title="Add Industry"
              action={saveIndustryAction}
              fields={FIELDS}
              submitLabel="Add Industry"
              trigger={
                <Button>
                  <Plus />
                  Add Industry
                </Button>
              }
            />
          ) : null
        }
      />

      <TableCard>
        <DataTable>
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Industry ID</TH>
            <TH>Industry</TH>
          </THead>

          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={3} message="No data found" />
            ) : (
              rows.map((industry) => (
                <TR key={industry.id}>
                  <TD>
                    <RowCheckbox id={industry.id} />
                  </TD>
                  <TD className="tabular">{industry.reference}</TD>
                  <TD>
                    <Link
                      href={`/settings/industries?edit=${industry.id}`}
                      scroll={false}
                      className="text-teal-600 hover:underline"
                    >
                      {industry.name}
                    </Link>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <RecordDrawer
          key={editing.id}
          title="Edit Industry"
          action={saveIndustryAction}
          fields={[{ kind: "hidden", name: "id", value: editing.id }, ...FIELDS]}
          values={{ name: editing.name }}
          routed
        />
      )}

      <BulkActionBar
        noun="industry"
        canDelete={manageAllowed}
        onDelete={deleteIndustriesAction}
      />
    </SelectionProvider>
  );
}
