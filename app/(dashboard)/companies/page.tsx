import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteCompaniesAction } from "@/app/(dashboard)/companies/actions";
import { CompanyDrawer } from "@/components/companies/company-drawer";
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
import { getIndustryNames } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Companies" };

const SEARCHABLE = ["name", "email", "phone", "city", "industry"];

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);

  const supabase = await createClient();

  let query = supabase
    .from("companies")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (params.q) query = query.or(ilikeAcross(SEARCHABLE, params.q));

  const [{ data, count, error }, industries] = await Promise.all([
    query,
    getIndustryNames(),
  ]);

  const rows = data ?? [];
  const total = count ?? 0;
  const writeAllowed = canWrite(role);

  const editingId = typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Companies"
        count={total}
        actions={
          writeAllowed ? (
            <CompanyDrawer
              industries={industries}
              trigger={
                <Button>
                  <Plus />
                  Add Company
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
        <DataTable className="min-w-[62rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Company</TH>
            <TH>Phone</TH>
            <TH>Email</TH>
            <TH>Address</TH>
            <TH>City</TH>
            <TH>State</TH>
            <TH>Industry</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={8}
                message="Those companies could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={8}
                message={
                  params.q
                    ? "No companies match that search"
                    : "No companies yet — add the schools and agencies you work with"
                }
              />
            ) : (
              rows.map((company) => (
                <TR key={company.id}>
                  <TD>
                    <RowCheckbox id={company.id} />
                  </TD>
                  <TD>
                    <Link
                      href={`/companies?edit=${company.id}`}
                      scroll={false}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      {company.name}
                    </Link>
                    {company.groups.length > 0 && (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {company.groups.map((group) => (
                          <span
                            key={group}
                            className="rounded-full bg-teal-50 px-1.5 py-px text-[10.5px] font-medium text-teal-700"
                          >
                            {group}
                          </span>
                        ))}
                      </span>
                    )}
                  </TD>
                  <TD className="tabular whitespace-nowrap">
                    {company.phone ?? <Blank />}
                  </TD>
                  <TD>
                    {company.email ? (
                      <a
                        href={`mailto:${company.email}`}
                        className="hover:text-teal-600 hover:underline"
                      >
                        {company.email}
                      </a>
                    ) : (
                      <Blank />
                    )}
                  </TD>
                  <TD>{company.address_line1 ?? <Blank />}</TD>
                  <TD>{company.city ?? <Blank />}</TD>
                  <TD>{company.province ?? <Blank />}</TD>
                  <TD>{company.industry ?? <Blank />}</TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <CompanyDrawer
          key={editing.id}
          company={editing}
          industries={industries}
          routed
        />
      )}

      <BulkActionBar
        noun="company"
        canDelete={canManage(role)}
        onDelete={deleteCompaniesAction}
      />
    </SelectionProvider>
  );
}
