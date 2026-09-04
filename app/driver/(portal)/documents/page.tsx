import type { Metadata } from "next";
import { FileText, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireDriver } from "@/lib/auth/session";
import { getOwnDocuments } from "@/lib/queries/driver";

/** Bare `YYYY-MM-DD` → "26 Aug 2026", timezone-free. */
function formatDay(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const metadata: Metadata = { title: "My documents" };

const DAY_MS = 86_400_000;

const TYPE_LABELS: Record<string, string> = {
  LICENSE: "Licence",
  MEDICAL_CERTIFICATE: "Medical certificate",
  BACKGROUND_CHECK: "Background check",
  TRAINING: "Training",
  OTHER: "Other",
};

function expiryState(expires_on: string | null) {
  if (!expires_on) return null;
  const days = Math.round(
    (new Date(`${expires_on}T00:00:00Z`).getTime() -
      new Date().setUTCHours(0, 0, 0, 0)) /
      DAY_MS,
  );
  if (days < 0) return { label: "Expired", variant: "destructive" as const };
  if (days <= 30)
    return { label: `Expires in ${days} d`, variant: "secondary" as const };
  return null;
}

export default async function DriverDocumentsPage() {
  await requireDriver();
  const documents = await getOwnDocuments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My documents"
        description="What your operator has on file for you. Ask them to update anything that's out of date."
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents on file"
          description="Your licence, medical certificate and training records show up here once your operator adds them."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-bone">
            {documents.map((doc) => {
              const expiry = expiryState(doc.expires_on);
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-ink">
                      {doc.name}
                    </p>
                    <p className="text-[12px] text-ash">
                      {TYPE_LABELS[doc.type] ?? doc.type}
                      {doc.expires_on
                        ? ` · expires ${formatDay(doc.expires_on)}`
                        : ""}
                    </p>
                  </div>
                  {expiry && (
                    <Badge variant={expiry.variant} className="shrink-0">
                      {expiry.variant === "destructive" && (
                        <TriangleAlert className="size-3" aria-hidden />
                      )}
                      {expiry.label}
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
