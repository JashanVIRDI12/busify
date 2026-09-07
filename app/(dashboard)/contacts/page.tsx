import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { deleteContactsAction } from "@/app/(dashboard)/contacts/actions";
import { ContactDrawer } from "@/components/contacts/contact-drawer";
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

export const metadata: Metadata = { title: "Contacts" };

const SEARCHABLE = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "city",
  "job_title",
];

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role } = await requireSession();
  const resolved = await searchParams;
  const params = parseListParams(resolved);

  const supabase = await createClient();

  // RLS scopes every one of these to the caller's organization.
  let query = supabase
    .from("customers")
    .select("*, companies(id, name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(params.from, params.to);

  if (params.q) query = query.or(ilikeAcross(SEARCHABLE, params.q));

  const [{ data: contacts, count, error }, { data: companies }, industries] =
    await Promise.all([
      query,
      supabase
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(500),
      getIndustryNames(),
    ]);

  const rows = contacts ?? [];
  const companyOptions = companies ?? [];
  const total = count ?? 0;
  const writeAllowed = canWrite(role);

  const editingId =
    typeof resolved.edit === "string" ? resolved.edit : undefined;
  const editing = rows.find((row) => row.id === editingId);

  return (
    <SelectionProvider ids={rows.map((row) => row.id)}>
      <PageHeading
        title="Contacts"
        count={total}
        actions={
          writeAllowed ? (
            <ContactDrawer
              industries={industries}
              companies={companyOptions}
              trigger={
                <Button>
                  <Plus />
                  Add Contact
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
        <DataTable className="min-w-[68rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Phone</TH>
            <TH>Company</TH>
            <TH>Address</TH>
            <TH>City</TH>
            <TH>State</TH>
            <TH>Industry</TH>
          </THead>

          <TBody>
            {error ? (
              <EmptyRow
                colSpan={9}
                message="Those contacts could not be loaded. Refresh to try again."
              />
            ) : rows.length === 0 ? (
              <EmptyRow
                colSpan={9}
                message={
                  params.q
                    ? "No contacts match that search"
                    : "No contacts yet — add the people who book with you"
                }
              />
            ) : (
              rows.map((contact) => (
                <TR key={contact.id}>
                  <TD>
                    <RowCheckbox id={contact.id} />
                  </TD>
                  <TD>
                    <Link
                      href={`/contacts?edit=${contact.id}`}
                      scroll={false}
                      className="font-medium hover:text-teal-600 hover:underline"
                    >
                      {[contact.first_name, contact.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </Link>
                  </TD>
                  <TD>
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="hover:text-teal-600 hover:underline"
                      >
                        {contact.email}
                      </a>
                    ) : (
                      <Blank />
                    )}
                  </TD>
                  <TD className="tabular whitespace-nowrap">
                    {formatPhone(contact.phone, contact.phone_extension)}
                  </TD>
                  <TD>
                    {contact.companies?.name ?? contact.company ?? <Blank />}
                  </TD>
                  <TD>{contact.address_line1 ?? <Blank />}</TD>
                  <TD>{contact.city ?? <Blank />}</TD>
                  <TD>{contact.province ?? <Blank />}</TD>
                  <TD>{contact.industry ?? <Blank />}</TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {editing && (
        <ContactDrawer
          key={editing.id}
          contact={editing}
          companies={companyOptions}
          industries={industries}
          routed
        />
      )}

      <BulkActionBar
        noun="contact"
        canDelete={canManage(role)}
        onDelete={deleteContactsAction}
      />
    </SelectionProvider>
  );
}

function formatPhone(phone: string | null, extension: string | null) {
  if (!phone) return <Blank />;
  return extension ? `${phone} ext. ${extension}` : phone;
}
