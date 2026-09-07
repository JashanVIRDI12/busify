"use client";

import { useFormStatus } from "react-dom";
import { Info, Loader2, Paperclip, Users } from "lucide-react";
import { toast } from "sonner";

import { updateEmailTemplateAction } from "@/app/(dashboard)/settings/company-actions";
import { FormAlert } from "@/components/data/form-fields";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { EmailTemplateKind, Tables } from "@/types/database";

export type EmailTemplate = Tables<"email_templates">;

/**
 * The placeholders a template may contain. Substituted when the mail is sent,
 * and listed here so an operator does not have to guess the spelling.
 */
const PLACEHOLDERS = [
  "{{ CONTACT_FIRST_NAME }}",
  "{{ SENDER_FULL_NAME }}",
  "{{ COMPANY_NAME }}",
  "{{ QUOTE_LINK }}",
  "{{ RESERVATION_ID }}",
];

export function TemplateCard({
  kind,
  title,
  hint,
  template,
  fromOptions,
  canEdit,
}: {
  kind: EmailTemplateKind;
  title: string;
  hint: string;
  template: EmailTemplate | undefined;
  fromOptions: string[];
  canEdit: boolean;
}) {
  const { state, formAction } = useActionForm(updateEmailTemplateAction, {
    onSuccess: () => toast.success(`${title} saved`),
  });

  return (
    <form action={formAction} className="panel overflow-hidden">
      <input type="hidden" name="kind" value={kind} />

      <div className="flex items-center gap-1.5 bg-teal-50 px-4 py-3">
        <h2 className="text-body font-semibold text-ink">{title}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label={`About the ${title}`}>
              <Info className="size-3.5 text-teal-600/70" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">{hint}</TooltipContent>
        </Tooltip>
      </div>

      <fieldset disabled={!canEdit} className="space-y-3 p-4">
        <FormAlert message={state.status === "error" ? state.message : undefined} />

        <label className="flex items-center gap-3 border-b border-bone pb-2.5">
          <span className="w-16 shrink-0 text-body-sm text-slate">From</span>
          <select
            name="from_email"
            defaultValue={template?.from_email ?? fromOptions[0] ?? ""}
            className="min-w-0 flex-1 bg-transparent text-body-sm text-teal-600 outline-none"
          >
            <option value="">Use the company email</option>
            {fromOptions.map((address) => (
              <option key={address} value={address}>
                {address}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 border-b border-bone pb-2.5">
          <span className="w-16 shrink-0 text-body-sm text-slate">Subject</span>
          <input
            name="subject"
            defaultValue={template?.subject ?? ""}
            className="min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none"
          />
        </label>

        <textarea
          name="body"
          rows={16}
          defaultValue={template?.body ?? ""}
          aria-label={`${title} message`}
          className="w-full rounded-md border border-cloud px-3.5 py-3 font-sans text-body-sm leading-relaxed text-ink outline-none focus-visible:border-orange-400"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-ash">Insert:</span>
          {PLACEHOLDERS.map((token) => (
            <code
              key={token}
              className="rounded bg-mist px-1.5 py-0.5 text-[11px] text-carbon"
            >
              {token}
            </code>
          ))}
        </div>

        <label className="flex items-center justify-between rounded-md bg-teal-50 px-3 py-2 text-body-sm text-teal-700">
          <span className="flex items-center gap-2">
            <Paperclip className="size-3.5" />
            Include the quote PDF by default
          </span>
          <input
            type="checkbox"
            name="include_pdf"
            defaultChecked={template?.include_pdf ?? true}
            className="size-4 accent-[var(--teal-500)]"
          />
        </label>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="flex items-center gap-1.5 text-[12px] text-ash">
            <Users className="size-3.5" />
            Personalised per recipient when sent
          </span>
          {canEdit && <SaveButton />}
        </div>
      </fieldset>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      Save
    </Button>
  );
}
