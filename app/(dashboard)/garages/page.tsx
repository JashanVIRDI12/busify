import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteGaragesAction } from "@/app/(dashboard)/garages/actions";
import { SearchField } from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
import { StatusPill } from "@/components/data/status-pill";
import {
  Blank,
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
import { GarageDrawer } from "@/components/garages/garage-drawer";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import {
  ilikeAcross,
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Garages" };

export default async function GaragesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);

  const supabase = await createClient();

  let query = supabase
    .from("garages")
    .select("*", { count: "exact" })
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })
    .range(params.from, params.to);

  if (params.q) {
    query = query.or(ilikeAcross(["name", "city", "address"], params.q));
  }

  const { data, count, error } = await query;

  const rows = data ?? [];
  const total = count ?? 0;
  const writeAllowed = canWrite(role);

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Garages"
        count={total}
        actions={
          writeAllowed ? (
            <GarageDrawer
              trigger={
                <Button>
                  <Plus />
                  Add Garage
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="mb-3.5">
        <SearchField placeholder="Search" />
      </div>

      <TableCard
        footer={
          <TablePagination
            page={params.page}
            pageCount={pageCount(total, params.per)}
            perPage={params.per}
          />
        }
      >
        <DataTable className="min-w-[52rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Garage</TH>
            <TH>Address</TH>
            <TH>City</TH>
            <TH>Province</TH>
            <TH>Postal Code</TH>
            <TH>Default</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow colSpan={7} message="Those garages could not be loaded." />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={7}
                message="No garages yet — add the depots your coaches run from"
              />
            ) : (
              rows.map((garage) => (
                <TR key={garage.id}>
                  <TD>
                    <RowCheckbox id={garage.id} />
                  </TD>
                  <TD>
                    <Link
                      href={`/garages?edit=${garage.id}`}
                      scroll={false}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      {garage.name}
                    </Link>
                  </TD>
                  <TD>{garage.address ?? <Blank />}</TD>
                  <TD>{garage.city ?? <Blank />}</TD>
                  <TD>{garage.province ?? <Blank />}</TD>
                  <TD className="tabular">{garage.postal_code ?? <Blank />}</TD>
                  <TD>
                    {garage.is_default ? (
                      <StatusPill label="Default" tone="teal" />
                    ) : (
                      <Blank />
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && <GarageDrawer key={editing.id} garage={editing} routed />}

      <BulkActionBar
        noun="garage"
        canDelete={canManage(role)}
        onDelete={deleteGaragesAction}
      />
    </SelectionProvider>
  );
}
