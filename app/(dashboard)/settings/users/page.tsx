import type { Metadata } from "next";

import { removeUsersAction } from "@/app/(dashboard)/settings/user-actions";
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
import { InviteUserDrawer } from "@/components/settings/invite-user-drawer";
import { RolePicker } from "@/components/settings/role-picker";
import { requireSession } from "@/lib/auth/session";
import { formatStamp } from "@/lib/datetime";
import {
  pageCount,
  parseListParams,
  type SearchParamsInput,
} from "@/lib/list-params";
import { canManage } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

/**
 * Everyone with a membership in this organization.
 *
 * `Last Login` lives on `auth.users`, which PostgREST does not expose, so it is
 * read through the admin client and matched up by id. That read is scoped to
 * the ids this organization's own membership query already returned — the
 * service-role client bypasses RLS, so the scoping has to be explicit here.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const { role, user, organization } = await requireSession();
  const params = parseListParams(await searchParams);

  const supabase = await createClient();

  const { data: members, count } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(params.from, params.to);

  const rows = members ?? [];
  const userIds = rows.map((member) => member.user_id);

  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const lastSignIn = await readLastSignIn(userIds);

  const term = params.q.toLowerCase();
  const visible = term
    ? rows.filter((member) => {
        const profile = profileById.get(member.user_id);
        return [profile?.full_name, profile?.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));
      })
    : rows;

  const manageAllowed = canManage(role);
  const zone = organization.timezone;

  return (
    <SelectionProvider ids={visible.map((member) => member.id)}>
      <PageHeading
        title="Users"
        count={count ?? rows.length}
        actions={manageAllowed ? <InviteUserDrawer /> : null}
      />

      <div className="mb-3.5">
        <SearchField placeholder="Search" />
      </div>

      <TableCard
        footer={
          <TablePagination
            page={params.page}
            pageCount={pageCount(count ?? rows.length, params.per)}
            perPage={params.per}
          />
        }
      >
        <DataTable className="min-w-[64rem]">
          <THead>
            <TH width="44px">
              <SelectAllCheckbox />
            </TH>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Type</TH>
            <TH>Created On</TH>
            <TH>Updated On</TH>
            <TH>Last Login</TH>
          </THead>

          <TBody>
            {visible.length === 0 ? (
              <EmptyRow colSpan={7} message="No data found" />
            ) : (
              visible.map((member) => {
                const profile = profileById.get(member.user_id);
                const signedIn = lastSignIn.get(member.user_id);

                return (
                  <TR key={member.id}>
                    <TD>
                      {/* Removing yourself from the table you are looking at is
                          never the intent, so it is not offered. */}
                      {member.user_id === user.id ? null : (
                        <RowCheckbox id={member.id} />
                      )}
                    </TD>
                    <TD className="font-medium">
                      {profile?.full_name ?? <Blank />}
                    </TD>
                    <TD>
                      {profile?.email ? (
                        <a
                          href={`mailto:${profile.email}`}
                          className="text-teal-600 hover:underline"
                        >
                          {profile.email}
                        </a>
                      ) : (
                        <Blank />
                      )}
                    </TD>
                    <TD>
                      <RolePicker
                        memberId={member.id}
                        role={member.role}
                        canEdit={manageAllowed && member.user_id !== user.id}
                        canAssignOwner={role === "OWNER"}
                      />
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatStamp(member.created_at, zone)}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {formatStamp(member.updated_at, zone)}
                    </TD>
                    <TD className="tabular whitespace-nowrap">
                      {signedIn ? (
                        formatStamp(signedIn, zone)
                      ) : (
                        <span className="text-ash">Never</span>
                      )}
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </DataTable>
      </TableCard>

      <BulkActionBar
        noun="user"
        canDelete={manageAllowed}
        onDelete={removeUsersAction}
      />
    </SelectionProvider>
  );
}

/**
 * Last sign-in per user, or an empty map when the service-role key is not
 * configured. A missing key makes the column blank; it never breaks the page.
 */
async function readLastSignIn(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return new Map();
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.error("Could not read sign-in times", error);
    return new Map();
  }

  const wanted = new Set(userIds);
  const result = new Map<string, string>();

  for (const account of data.users) {
    if (wanted.has(account.id) && account.last_sign_in_at) {
      result.set(account.id, account.last_sign_in_at);
    }
  }

  return result;
}
