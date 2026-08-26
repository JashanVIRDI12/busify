import type { Metadata } from "next";
import { Plus, Users } from "lucide-react";

import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CustomerRowActions } from "@/components/customers/customer-row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { ListShell } from "@/components/shared/list-shell";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSession } from "@/lib/auth/session";
import { canManage, canWrite } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { role } = await requireSession();
  const { q } = await searchParams;

  const supabase = await createClient();

  // RLS scopes this to the caller's organization — no manual filter needed.
  let query = supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},company.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data: customers, error } = await query;

  const writeAllowed = canWrite(role);
  const deleteAllowed = canManage(role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="The schools, corporates and agencies you quote and dispatch for."
        actions={
          writeAllowed ? (
            <CustomerDialog
              trigger={
                <Button>
                  <Plus />
                  Add customer
                </Button>
              }
            />
          ) : null
        }
      />

      <ListShell
        toolbar={
          <>
            <SearchInput placeholder="Search name, email, company…" />
            {customers && customers.length > 0 && (
              <p className="tabular text-sm text-muted-foreground">
                {formatNumber(customers.length)}{" "}
                {customers.length === 1 ? "customer" : "customers"}
              </p>
            )}
          </>
        }
      >
        {error ? (
          <EmptyState
            icon={Users}
            title="We could not load your customers"
            description="The request failed. Refresh the page, and if it keeps happening check your Supabase connection."
          />
        ) : !customers || customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No customers match that search" : "No customers yet"}
            description={
              q
                ? "Try a shorter search term, or clear the search to see everyone."
                : "Add the people who book your coaches. You can attach them to trip requests, quotes and bookings."
            }
            action={
              !q && writeAllowed ? (
                <CustomerDialog
                  trigger={
                    <Button>
                      <Plus />
                      Add your first customer
                    </Button>
                  }
                />
              ) : null
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ")}
                    {customer.notes && (
                      <span className="mt-0.5 block max-w-md truncate text-xs font-normal text-muted-foreground">
                        {customer.notes}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.company ?? "—"}
                  </TableCell>
                  <TableCell>
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-interactive hover:underline"
                      >
                        {customer.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {customer.phone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <CustomerRowActions
                      customer={customer}
                      canEdit={writeAllowed}
                      canDelete={deleteAllowed}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListShell>
    </div>
  );
}
