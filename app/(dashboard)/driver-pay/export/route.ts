import { NextResponse, type NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { formatStamp } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

/**
 * CSV of whichever driver-pay tab the operator is looking at.
 *
 * Payroll leaves this product — it goes into an accountant's spreadsheet or a
 * payroll provider's importer — so the export is a plain route rather than a
 * client-side download, which keeps the row limit and the tenant scoping on the
 * server where RLS still applies.
 */
export async function GET(request: NextRequest) {
  const { organization } = await requireSession();
  const supabase = await createClient();
  const zone = organization.timezone;

  const tab = request.nextUrl.searchParams.get("tab");

  if (tab === "stubs") {
    const { data } = await supabase
      .from("driver_pay_stubs")
      .select("*, drivers(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(5000);

    const rows = (data ?? []).map((stub) => [
      stub.reference,
      stub.status,
      [stub.drivers?.first_name, stub.drivers?.last_name].filter(Boolean).join(" "),
      stub.total_pay,
      stub.payment_date ?? "",
      stub.period_start ?? "",
      stub.period_end ?? "",
    ]);

    return csv(
      ["Pay Stub", "Status", "Driver", "Total Pay", "Payment Date", "From", "To"],
      rows,
      "driver-pay-stubs.csv",
    );
  }

  const { data } = await supabase
    .from("driver_pay_entries")
    .select(
      "*, drivers(first_name, last_name), trips(reference, status, companies(name))",
    )
    .order("starts_at", { ascending: false })
    .limit(5000);

  const rows = (data ?? []).map((entry) => [
    entry.trips?.reference ?? "",
    entry.trips?.status ?? "",
    [entry.drivers?.first_name, entry.drivers?.last_name].filter(Boolean).join(" "),
    entry.status,
    entry.rate_basis,
    entry.rate,
    entry.quantity,
    entry.total_pay,
    entry.starts_at ? formatStamp(entry.starts_at, zone) : "",
    entry.ends_at ? formatStamp(entry.ends_at, zone) : "",
    entry.trips?.companies?.name ?? "",
  ]);

  return csv(
    [
      "Res ID",
      "Res Status",
      "Driver",
      "Status",
      "Basis",
      "Rate",
      "Quantity",
      "Total Pay",
      "Start",
      "End",
      "Company",
    ],
    rows,
    "driver-pay.csv",
  );
}

function csv(
  header: string[],
  rows: (string | number | null)[][],
  filename: string,
) {
  const body = [header, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * A leading `=`, `+`, `-` or `@` makes Excel treat a cell as a formula, so a
 * driver named "-Smith" or a note pasted from elsewhere becomes executable on
 * open. Prefixing a quote neutralises that without changing what is displayed.
 */
function escapeCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}
