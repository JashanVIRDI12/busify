import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { getQuotePdfData } from "@/lib/queries/quote-pdf";
import { createClient } from "@/lib/supabase/server";

/**
 * The quote PDF, for the operator.
 *
 * A route rather than a Server Action because the browser needs to receive a
 * file: an action can only return serialisable data, which would mean
 * base64-ing the document through the RSC payload just to rebuild it on the
 * client. RLS still applies — the document is built with the caller's session.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireSession();

  const { id } = await params;
  const supabase = await createClient();

  const data = await getQuotePdfData(supabase, id);
  if (!data) {
    return new NextResponse("Quote not found", { status: 404 });
  }

  const pdf = await renderQuotePdf(data);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      // `inline` so it previews in the browser; the operator can still save it.
      "content-disposition": `inline; filename="${data.quote.reference}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
