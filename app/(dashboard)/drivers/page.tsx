import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteDriversAction } from "@/app/(dashboard)/drivers/actions";
import { DriverDrawer } from "@/components/drivers/driver-drawer";
import { SearchField } from "@/components/data/filters";
import { PageHeading } from "@/components/data/page-heading";
import {
  BulkActionBar,
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/data/selection";
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
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Drivers" };

const SEARCHABLE = ["first_name", "last_name", "email", "phone", "license_number"];

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);

  const supabase = await createClient();

  let query = supabase
    .from("drivers")
    .select("*, garages(id, name)", { count: "exact" })
    .order("first_name", { ascending: true })
    .range(params.from, params.to);

  if (params.q) query = query.or(ilikeAcross(SEARCHABLE, params.q));

  const [{ data, count, error }, { data: garages }] = await Promise.all([
    query,
    supabase.from("garages").select("id, name").order("name").limit(200),
  ]);

  const rows = data ?? [];
  const garageOptions = garages ?? [];
  const total = count ?? 0;
  const writeAllowed = canWrite(role);

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Drivers"
        count={total}
        actions={
          writeAllowed ? (
            <DriverDrawer
              garages={garageOptions}
              trigger={
                <Button>
                  <Plus />
                  Add Driver
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
        <DataTable className="min-w-[54rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Name</TH>
            <TH>Phone Number</TH>
            <TH>Email</TH>
            <TH>Garage</TH>
            <TH>Active</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={6}
                message="Those drivers could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message={
                  params.q ? "No drivers match that search" : "No drivers yet"
                }
              />
            ) : (
              rows.map((driver) => {
                const active = driver.status === "ACTIVE";
                return (
                  <TR key={driver.id}>
                    <TD>
                      <RowCheckbox id={driver.id} />
                    </TD>
                    <TD>
                      <Link
                        href={`/drivers?edit=${driver.id}`}
                        scroll={false}
                        className="font-medium hover:text-teal-600 hover:underline"
                      >
                        {[driver.first_name, driver.last_name]
                          .filter(Boolean)
                          .join(" ")}
                      </Link>
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {driver.phone ?? <Blank />}
                    </TD>
                    <TD>
                      {driver.email ? (
                        <a
                          href={`mailto:${driver.email}`}
                          className="hover:text-teal-600 hover:underline"
                        >
                          {driver.email}
                        </a>
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD>{driver.garages?.name ?? <Blank />}</TD>
                    <TD
                      className={cn(
                        "font-medium",
                        active ? "text-ink" : "text-slate",
                      )}
                    >
                      {active ? "Active" : "Not Active"}
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <DriverDrawer
          key={editing.id}
          driver={editing}
          garages={garageOptions}
          routed
        />
      )}

      <BulkActionBar
        noun="driver"
        canDelete={canManage(role)}
        onDelete={deleteDriversAction}
      />
    </SelectionProvider>
  );
}
