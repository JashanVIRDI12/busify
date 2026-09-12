import "server-only";

import type { Organization } from "@/lib/auth/session";
import type { SetupState } from "@/lib/queries/dashboard";
import { createClient } from "@/lib/supabase/server";

/**
 * First-run progress, for the page a new operator lands on after onboarding.
 *
 * Deliberately not the dashboard's checklist. That one is about having work to
 * do — customers, requests, a fleet to dispatch. This one is about the company
 * being *configured*: the details that end up on a quote, the garages trips
 * leave from, and the rate card without which the builder prices everything at
 * zero. Counts only, so the page stays cheap enough to open on every visit.
 */
export async function getSetupProgress(
  organization: Organization,
): Promise<SetupState> {
  const supabase = await createClient();

  const count = (table: "garages" | "vehicle_types" | "vehicle_rates" | "vehicles" | "drivers") =>
    supabase.from(table).select("id", { count: "exact", head: true });

  const [garages, vehicleTypes, rates, vehicles, drivers, members] =
    await Promise.all([
      count("garages"),
      count("vehicle_types"),
      count("vehicle_rates"),
      count("vehicles"),
      count("drivers"),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true }),
    ]);

  const steps = [
    {
      id: "company",
      label: "Complete your company details",
      description:
        "Your address, phone and tax number appear on every quote and invoice.",
      href: "/settings/organization",
      done: Boolean(organization.email && organization.phone && organization.city),
    },
    {
      id: "garages",
      label: "Add a garage",
      description: "Where your coaches start and finish. Dead miles are measured from it.",
      href: "/settings/garages",
      done: (garages.count ?? 0) > 0,
    },
    {
      id: "vehicle-types",
      label: "Define a vehicle type",
      description: "Classes like Luxury Coach are what the rate card prices.",
      href: "/vehicles/types",
      done: (vehicleTypes.count ?? 0) > 0,
    },
    {
      id: "rates",
      label: "Set your rates",
      description:
        "Hourly, daily and per-mile. Without these the quote builder prices everything at zero.",
      href: "/settings/rates",
      done: (rates.count ?? 0) > 0,
    },
    {
      id: "vehicles",
      label: "Add your fleet",
      description: "Availability is checked against real coaches and their seats.",
      href: "/vehicles",
      done: (vehicles.count ?? 0) > 0,
    },
    {
      id: "drivers",
      label: "Add your drivers",
      description: "Needed before a trip can be dispatched.",
      href: "/drivers",
      done: (drivers.count ?? 0) > 0,
    },
    {
      id: "team",
      label: "Invite your team",
      description: "Dispatchers, accountants and drivers, each with their own access.",
      href: "/settings/users",
      // The founder's own membership is already there, so one is not progress.
      done: (members.count ?? 0) > 1,
    },
  ];

  const completed = steps.filter((step) => step.done).length;

  return {
    steps,
    completed,
    total: steps.length,
    isComplete: completed === steps.length,
  };
}
