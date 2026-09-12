import type { Metadata } from "next";
import Link from "next/link";
import { Info, Plus } from "lucide-react";

import {
  deleteSavedStopsAction,
  saveSavedStopAction,
} from "@/app/(dashboard)/settings/catalog-actions";
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
import { RecordDrawer, type FieldSpec } from "@/components/settings/record-drawer";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { requireSession } from "@/lib/auth/session";
import type { SearchParamsInput } from "@/lib/list-params";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Saved Stops" };

const FIELDS: FieldSpec[] = [
  { kind: "text", name: "name", label: "Name", required: true },
  { kind: "text", name: "address", label: "Address" },
  { kind: "textarea", name: "notes", label: "Notes — gate codes, where to wait", rows: 4 },
];

export default async function SavedStopsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("saved_stops")
    .select("*", { count: "exact" })
    .order("name", { ascending: true });

  const rows = data ?? [];
  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Saved Stops"
        count={count ?? rows.length}
        actions={
          canWrite(role) ? (
            <RecordDrawer
              title="Add Saved Stop"
              action={saveSavedStopAction}
              fields={FIELDS}
              submitLabel="Add Saved Stop"
              trigger={
                <Button>
                  <Plus />
                  Add Saved Stop
                </Button>
              }
            />
          ) : null
        }
      />

      <p className="mb-3.5 flex items-center gap-1.5 text-body-sm text-slate">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label="About saved stops">
              <Info className="size-4 text-ash" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-72">
            Addresses you use often. They appear as suggestions when building an
            itinerary, so a school or a hotel entrance is typed once.
          </TooltipContent>
        </Tooltip>
        Addresses your dispatchers can reuse when building an itinerary.
      </p>

      <TableCard>
        <DataTable>
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Name</TH>
            <TH>Address</TH>
            <TH>Notes</TH>
          </THead>

          <TBody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={4} message="No data found" />
            ) : (
              rows.map((stop) => (
                <TR key={stop.id}>
                  <TD>
                    <RowCheckbox id={stop.id} />
                  </TD>
                  <TD>
                    <Link
                      href={`/settings/saved-stops?edit=${stop.id}`}
                      scroll={false}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      {stop.name}
                    </Link>
                  </TD>
                  <TD>{stop.address ?? <Blank />}</TD>
                  <TD className="max-w-[24rem] truncate">
                    {stop.notes ?? <Blank />}
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
          title="Edit Saved Stop"
          action={saveSavedStopAction}
          fields={[{ kind: "hidden", name: "id", value: editing.id }, ...FIELDS]}
          values={editing}
          routed
        />
      )}

      <BulkActionBar
        noun="stop"
        canDelete={canManage(role)}
        onDelete={deleteSavedStopsAction}
      />
    </SelectionProvider>
  );
}
