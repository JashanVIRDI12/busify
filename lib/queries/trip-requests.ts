import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type TripRequest = Tables<"trip_requests">;

export async function getTripRequest(id: string) {
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("trip_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !request) return null;

  const customer = request.customer_id
    ? (
        await supabase
          .from("customers")
          .select("*")
          .eq("id", request.customer_id)
          .maybeSingle()
      ).data
    : null;

  return { request, customer };
}
