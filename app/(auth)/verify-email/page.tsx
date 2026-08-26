import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthCard
      title="Confirm your email"
      description={
        email
          ? `We sent a confirmation link to ${email}. Open it to finish setting up your account.`
          : "We sent you a confirmation link. Open it to finish setting up your account."
      }
      footer={
        <Link href="/login" className="font-medium text-interactive hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-interactive" aria-hidden />
        <p className="text-sm text-muted-foreground text-pretty">
          Nothing in your inbox? Check spam, then resend below. Links expire after
          an hour.
        </p>
      </div>

      <div className="mt-5">
        <ResendVerificationForm email={email} />
      </div>
    </AuthCard>
  );
}
