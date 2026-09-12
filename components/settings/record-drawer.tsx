"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  FormAlert,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from "@/components/data/form-fields";
import {
  DrawerBody,
  DrawerFooter,
  DrawerForm,
  SideDrawer,
} from "@/components/shell/side-drawer";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { useListParams } from "@/lib/hooks/use-list-params";

export type FieldSpec =
  | {
      kind: "text" | "number" | "money" | "date";
      name: string;
      label: string;
      required?: boolean;
      /** Half-width, so two can share a line. */
      half?: boolean;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      options: { value: string; label: string }[];
      required?: boolean;
      half?: boolean;
    }
  | { kind: "textarea"; name: string; label: string; rows?: number }
  | { kind: "toggle"; name: string; label: string; description?: string }
  | { kind: "hidden"; name: string; value: string };

/**
 * One drawer for every small settings record.
 *
 * Industries, saved stops, rate rows, charges and garages are all "three to six
 * fields and a save button" — writing five near-identical components would mean
 * five places to fix the next time the drawer changes. The forms that are
 * genuinely different (a contact, a vehicle) keep their own component.
 */
export function RecordDrawer({
  title,
  action,
  fields,
  values,
  trigger,
  routed = false,
  submitLabel,
  width,
}: {
  title: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  /**
   * The record being edited. Typed loosely on purpose: callers pass the row
   * straight from the query, embedded relations and all, and the drawer only
   * ever reads the keys its own `fields` name.
   */
  values?: Record<string, unknown>;
  trigger?: ReactNode;
  routed?: boolean;
  submitLabel?: string;
  width?: string;
}) {
  const { setParams } = useListParams();
  const [open, setOpen] = useState(routed);

  function close() {
    setOpen(false);
    if (routed) setParams({ edit: null }, { keepPage: true });
  }

  const { state, formAction, reset } = useActionForm(action, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Saved");
      close();
    },
  });

  function initial(name: string): string {
    const value = values?.[name];
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return "";
    return String(value);
  }

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
        title={title}
        width={width}
      >
        <DrawerForm action={formAction}>
          <DrawerBody>
            <FormAlert
              message={state.status === "error" ? state.message : undefined}
            />

            <div className="grid grid-cols-2 gap-3.5">
              {fields.map((field) => {
                if (field.kind === "hidden") {
                  return (
                    <input
                      key={field.name}
                      type="hidden"
                      name={field.name}
                      value={field.value}
                    />
                  );
                }

                const span = "half" in field && field.half ? "" : "col-span-2";

                if (field.kind === "select") {
                  return (
                    <SelectField
                      key={field.name}
                      className={span}
                      name={field.name}
                      placeholder={field.label}
                      options={field.options}
                      defaultValue={initial(field.name) || undefined}
                      errors={state.fieldErrors}
                    />
                  );
                }

                if (field.kind === "textarea") {
                  return (
                    <TextAreaField
                      key={field.name}
                      className="col-span-2"
                      name={field.name}
                      placeholder={field.label}
                      rows={field.rows ?? 4}
                      defaultValue={initial(field.name)}
                      errors={state.fieldErrors}
                    />
                  );
                }

                if (field.kind === "toggle") {
                  return (
                    <div key={field.name} className="col-span-2 py-1">
                      <ToggleField
                        name={field.name}
                        label={field.label}
                        description={field.description}
                        defaultChecked={Boolean(values?.[field.name])}
                      />
                    </div>
                  );
                }

                return (
                  <TextField
                    key={field.name}
                    className={span}
                    name={field.name}
                    placeholder={field.label}
                    required={field.required}
                    type={field.kind === "date" ? "date" : undefined}
                    inputMode={
                      field.kind === "number" || field.kind === "money"
                        ? "decimal"
                        : undefined
                    }
                    defaultValue={initial(field.name)}
                    errors={state.fieldErrors}
                  />
                );
              })}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <SubmitButton label={submitLabel ?? "Save"} />
          </DrawerFooter>
        </DrawerForm>
      </SideDrawer>
    </>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {label}
    </Button>
  );
}
