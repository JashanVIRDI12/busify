"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTermsAction,
  saveTermsAction,
} from "@/app/(dashboard)/settings/company-actions";
import { FormAlert, TextField, ToggleField } from "@/components/data/form-fields";
import {
  DataTable,
  EmptyRow,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableCard,
} from "@/components/data/table";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import { formatStampDate } from "@/lib/datetime";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { cn } from "@/lib/utils";
import type { Tables, TermsKind } from "@/types/database";

type Terms = Tables<"contract_terms">;

/**
 * Contract terms and quote terms, which are the same record with a different
 * `kind`: one is the agreement a customer signs, the other is the small print
 * on the quote page. Splitting them into two tables would have meant two of
 * everything for one difference.
 */
export function TermsPanel({
  kind,
  terms,
  canEdit,
}: {
  kind: TermsKind;
  terms: Terms[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Terms | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();

  const heading = kind === "CONTRACT" ? "Contract Terms" : "Quote Terms";

  return (
    <div className="panel p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subheading font-semibold text-ink">{heading}</h2>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Add Terms
          </Button>
        )}
      </div>

      <TableCard>
        <DataTable>
          <THead>
            <TH>Name</TH>
            <TH>Created Date</TH>
            <TH>Updated Date</TH>
            <TH>Default</TH>
            <TH width="56px" />
          </THead>

          <TBody>
            {terms.length === 0 ? (
              <EmptyRow
                colSpan={5}
                message={`No ${heading.toLowerCase()} yet — add the wording you send with every quote`}
              />
            ) : (
              terms.map((row) => (
                <TR key={row.id}>
                  <TD>
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      className="font-medium text-teal-600 hover:underline"
                    >
                      {row.name}
                    </button>
                  </TD>
                  <TD className="tabular">
                    {formatStampDate(row.created_at, "UTC", { shortYear: true })}
                  </TD>
                  <TD className="tabular">
                    {formatStampDate(row.updated_at, "UTC", { shortYear: true })}
                  </TD>
                  <TD className={cn(row.is_default ? "text-ink" : "text-slate")}>
                    {row.is_default ? "Yes" : "No"}
                  </TD>
                  <TD align="right">
                    {canEdit && (
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Delete ${row.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deleteTermsAction(row.id);
                            if (result.ok) toast.success("Terms deleted");
                            else toast.error(result.message);
                          })
                        }
                        className="text-ash transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </DataTable>
      </TableCard>

      {(creating || editing) && (
        <TermsDrawer
          key={editing?.id ?? "new"}
          kind={kind}
          terms={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function TermsDrawer({
  kind,
  terms,
  onClose,
}: {
  kind: TermsKind;
  terms: Terms | null;
  onClose: () => void;
}) {
  const { state, formAction } = useActionForm(saveTermsAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Saved");
      onClose();
    },
  });

  return (
    <SideDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={terms ? "Edit Terms" : "Add Terms"}
      width="sm:w-[38rem]"
    >
      <DrawerForm action={formAction}>
        <input type="hidden" name="kind" value={kind} />
        {terms && <input type="hidden" name="id" value={terms.id} />}

        <DrawerBody>
          <FormAlert message={state.status === "error" ? state.message : undefined} />

          <TextField
            name="name"
            placeholder="Name"
            defaultValue={terms?.name ?? ""}
            errors={state.fieldErrors}
            required
          />

          <textarea
            name="body"
            rows={18}
            placeholder="The wording your customer agrees to."
            aria-label="Terms"
            defaultValue={terms?.body ?? ""}
            className="w-full rounded-md border border-cloud px-3.5 py-3 text-body-sm leading-relaxed text-ink outline-none placeholder:text-ash focus-visible:border-orange-400"
          />

          <ToggleField
            name="is_default"
            label="Use these on new quotes"
            defaultChecked={terms?.is_default ?? false}
          />
        </DrawerBody>

        <DrawerFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton />
        </DrawerFooter>
      </DrawerForm>
    </SideDrawer>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save
    </Button>
  );
}
