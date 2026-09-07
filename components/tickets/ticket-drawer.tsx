"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  addTicketCommentAction,
  createTicketAction,
  updateTicketAction,
} from "@/app/(dashboard)/tickets/actions";
import {
  ComboField,
  FormAlert,
  SelectField,
  TextField,
} from "@/components/data/form-fields";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";
import { TICKET_TYPES, toOptions } from "@/lib/taxonomy";
import {
  TICKET_SEVERITIES,
  TICKET_SEVERITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
} from "@/lib/validations/ticket";
import type { Tables } from "@/types/database";

type Ticket = Tables<"tickets">;

export type TicketComment = {
  id: string;
  body: string;
  created_at: string;
  author: string;
};

export type ReservationOption = {
  value: string;
  label: string;
  hint?: string;
};

export function TicketDrawer({
  trigger,
  ticket,
  reservations,
  people,
  comments = [],
  routed = false,
}: {
  trigger?: ReactNode;
  ticket?: Ticket;
  reservations: ReservationOption[];
  people: { id: string; name: string }[];
  comments?: TicketComment[];
  routed?: boolean;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);
  const editing = Boolean(ticket);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(
    editing ? updateTicketAction : createTicketAction,
    {
      onSuccess: () => {
        toast.success(editing ? "Ticket updated" : "Ticket created");
        close();
      },
    },
  );

  return (
    <>
      {trigger && (
        <span
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          {trigger}
        </span>
      )}

      <SideDrawer
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={editing ? `Ticket ${ticket!.reference ?? ""}`.trim() : "Create Ticket"}
      >
        <DrawerForm action={formAction}>
          {editing && <input type="hidden" name="id" value={ticket!.id} />}

          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <ComboField
              name="trip_id"
              placeholder="Reservation ID"
              options={reservations}
              defaultValue={ticket?.trip_id ?? undefined}
              errors={state.fieldErrors}
              emptyText="No reservations match"
            />

            <SelectField
              name="ticket_type"
              placeholder="Ticket Type"
              defaultValue={ticket?.ticket_type ?? undefined}
              options={toOptions(TICKET_TYPES)}
              errors={state.fieldErrors}
            />

            <TextField
              name="title"
              placeholder="Title"
              defaultValue={ticket?.title ?? ""}
              errors={state.fieldErrors}
              required
            />

            <SelectField
              name="severity"
              placeholder="Severity"
              defaultValue={ticket?.severity ?? "MEDIUM"}
              options={TICKET_SEVERITIES.map((value) => ({
                value,
                label: TICKET_SEVERITY_LABELS[value]!,
              }))}
              errors={state.fieldErrors}
            />

            <SelectField
              name="assignee_id"
              placeholder="Assign To"
              defaultValue={ticket?.assignee_id ?? undefined}
              options={people.map((person) => ({
                value: person.id,
                label: person.name,
              }))}
              errors={state.fieldErrors}
            />

            {editing && (
              <SelectField
                name="status"
                placeholder="Status"
                defaultValue={ticket?.status ?? "OPEN"}
                options={TICKET_STATUSES.map((value) => ({
                  value,
                  label: TICKET_STATUS_LABELS[value]!,
                }))}
                errors={state.fieldErrors}
              />
            )}

            <div>
              <p className="mb-2 text-body-sm text-ash">Comments</p>

              {editing ? (
                <CommentThread ticketId={ticket!.id} comments={comments} />
              ) : (
                // Before the ticket exists there is nothing to attach a comment
                // to, so the opening note rides along with the create request.
                <textarea
                  name="comment"
                  rows={5}
                  placeholder="Type comment here..."
                  aria-label="Opening comment"
                  className="w-full rounded-md border border-cloud bg-signal-white px-3.5 py-2.5 text-body-sm text-ink outline-none placeholder:text-ash hover:border-fog focus-visible:border-orange-400"
                />
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton />
          </DrawerFooter>
        </DrawerForm>
      </SideDrawer>
    </>
  );
}

function CommentThread({
  ticketId,
  comments,
}: {
  ticketId: string;
  comments: TicketComment[];
}) {
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    const body = draft.trim();
    if (!body) return;

    startTransition(async () => {
      const result = await addTicketCommentAction(ticketId, body);
      if (result.ok) setDraft("");
      else toast.error(result.message);
    });
  }

  return (
    <div className="rounded-md border border-cloud">
      <div className="scrollbar-slim max-h-56 space-y-3 overflow-y-auto p-3">
        {comments.length === 0 ? (
          <p className="py-4 text-center text-body-sm text-ash">
            No comments yet
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id}>
              <p className="text-[11.5px] font-medium text-slate">
                {comment.author}
              </p>
              <p className="text-body-sm whitespace-pre-wrap text-ink">
                {comment.body}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-bone px-3 py-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends: this is a chat box inside a form, and letting it
            // bubble would submit the ticket instead.
            if (event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Type comment here..."
          aria-label="Add a comment"
          className="flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ash"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || draft.trim().length === 0}
          aria-label="Send comment"
          className="text-teal-500 transition-colors hover:text-teal-600 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </button>
      </div>
    </div>
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
