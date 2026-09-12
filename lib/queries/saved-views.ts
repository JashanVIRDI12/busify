import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SavedView } from "@/components/data/saved-views";

/**
 * The saved chips for one list. RLS already limits this to views the caller
 * owns or that were explicitly shared with their organization.
 */
export async function getSavedViews(resource: string): Promise<SavedView[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("saved_views")
    .select("id, name, query, is_shared")
    .eq("resource", resource)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load saved views", error);
    return [];
  }

  return data ?? [];
}
