import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Person = { id: string; name: string; email: string | null };

/**
 * Everyone in the caller's organization, for assignee and sales-rep pickers.
 *
 * Read from `profiles` rather than by joining `organization_members`: those
 * rows point at `auth.users`, which PostgREST will not embed, and the profiles
 * policy already limits a read to the caller and their teammates.
 */
export async function getPeople(): Promise<Person[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Failed to load teammates", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name?.trim() || row.email || "Unknown",
    email: row.email,
  }));
}

/** `{ [userId]: displayName }` for rendering "Created By" style columns. */
export function peopleById(people: Person[]): Record<string, string> {
  return Object.fromEntries(people.map((person) => [person.id, person.name]));
}
