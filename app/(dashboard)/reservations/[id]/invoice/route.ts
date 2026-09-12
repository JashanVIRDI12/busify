import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { getInvoicePdfData } from "@/lib/queries/invoice-pdf";
import { createClient } from "@/lib/supabase/server";

/** The invoice for one reservation, built with the caller's session so RLS applies. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();

  const { id } = await params;
  const supabase = await createClient();

  const data = await getInvoicePdfData(supabase, id);
  if (!data) {
    return new NextResponse("Reservation not found", { status: 404 });
  }

  const pdf = await renderQuotePdf(data);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${data.quote.reference}-invoice.pdf"`,
      "cache-control": "no-store",
    },
  });
}
