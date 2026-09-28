"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Building2, Check, Loader2, Mail, Phone, Plus, Search, User } from "lucide-react";

import {
  createCustomerForQuote,
  searchCustomersForQuote,
  type CustomerHit,
} from "@/app/(dashboard)/quotes/builder-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useBuilder } from "./builder-context";

/** "Helen Boyd" → "HB"; a one-word name gives its first letter. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words.at(-1)![0]] : [words[0]?.[0]];
  return letters.join("").toUpperCase() || "?";
}

function CustomerCard({
  customer,
  onClear,
  canEdit,
  actionLabel,
}: {
  customer: CustomerHit;
  onClear: () => void;
  canEdit: boolean;
  /** "Change" for the customer, who must exist; "Remove" for the optional billing contact. */
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-bone bg-signal-white p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-body-sm font-semibold text-teal-700"
        >
          {initialsOf(customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-ink">{customer.name}</p>
          {customer.company && (
            <p className="flex items-center gap-1.5 truncate text-body-sm text-slate">
              <Building2 className="size-3.5 shrink-0 text-ash" aria-hidden />
              {customer.company}
            </p>
          )}
        </div>
        {canEdit && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onClear}
            aria-label={`${actionLabel} ${customer.name}`}
          >
            {actionLabel}
          </Button>
        )}
      </div>

      {(customer.email || customer.phone) && (
        <div className="mt-3 flex flex-col gap-1.5 border-t border-bone pt-3 text-body-sm">
          {customer.email && (
            <a
              href={`mailto:${customer.email}`}
              className="flex min-w-0 items-center gap-2 text-slate transition-colors hover:text-teal-600"
            >
              <Mail className="size-3.5 shrink-0 text-ash" aria-hidden />
              <span className="truncate">{customer.email}</span>
            </a>
          )}
          {customer.phone && (
            <a
              href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}
              className="tabular flex items-center gap-2 text-slate transition-colors hover:text-teal-600"
            >
              <Phone className="size-3.5 shrink-0 text-ash" aria-hidden />
              {customer.phone}
            </a>
          )}
        </div>
      )}
      {!customer.email && !customer.phone && (
        <p className="mt-3 border-t border-bone pt-3 text-[12px] text-ash">
          No email or phone on file.
        </p>
      )}
    </div>
  );
}

function CustomerSearch({
  onPick,
  onCreate,
}: {
  onPick: (customer: CustomerHit) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState(false);
  // Index into the results, where results.length is "Create new customer".
  const [active, setActive] = useState(-1);
  const [searching, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(customer: CustomerHit) {
    onPick(customer);
    setOpen(false);
    setQuery("");
    setActive(-1);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        // A search that cannot reach the server says so in the list. Left to
        // throw, the rejection would take the whole builder down with it.
        try {
          setResults(await searchCustomersForQuote(query));
          setFailed(false);
        } catch {
          setResults([]);
          setFailed(true);
        }
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-cloud bg-signal-white px-3.5 transition-colors hover:border-fog focus-within:border-orange-400">
        <Search className="size-4 shrink-0 text-ash" aria-hidden />
        <input
          value={query}
          role="combobox"
          aria-label="Search customers"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            const last = results.length; // the Create row
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((i) => (i >= last ? 0 : i + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => (i <= 0 ? last : i - 1));
            } else if (event.key === "Enter" && open && active >= 0) {
              event.preventDefault();
              if (active === last) onCreate();
              else choose(results[active]!);
            } else if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
          }}
          placeholder="Search for name, email, or phone number"
          className="h-11 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ash"
        />
        {searching && (
          <Loader2 className="size-4 shrink-0 animate-spin text-ash" aria-hidden />
        )}
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Customers"
          className="absolute z-20 mt-1.5 max-h-80 w-full overflow-y-auto rounded-xl border border-bone bg-signal-white p-1.5 shadow-(--shadow-layered)"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-body-sm text-ash">
              {failed
                ? "Could not search customers. Check your connection and keep typing to try again."
                : query
                  ? `No customers match “${query.trim()}”.`
                  : "Start typing to search customers."}
            </p>
          ) : (
            results.map((customer, index) => (
              <button
                key={customer.id}
                id={optionId(index)}
                type="button"
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(customer)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  index === active ? "bg-mist" : "hover:bg-mist",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-plaster text-ash">
                  {customer.company ? (
                    <Building2 className="size-4" />
                  ) : (
                    <User className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-sm font-semibold text-ink">
                    {customer.name}
                    {customer.company ? ` · ${customer.company}` : ""}
                  </span>
                  <span className="block truncate text-[12px] text-ash">
                    {customer.email ?? customer.phone ?? "No contact details"}
                  </span>
                </span>
              </button>
            ))
          )}
          <button
            id={optionId(results.length)}
            type="button"
            role="option"
            aria-selected={active === results.length}
            tabIndex={-1}
            onMouseEnter={() => setActive(results.length)}
            onClick={onCreate}
            className={cn(
              "mt-1 flex w-full items-center gap-2 rounded-lg border-t border-bone px-3 py-2.5 text-body-sm font-semibold text-teal-600 transition-colors",
              active === results.length ? "bg-teal-50" : "hover:bg-teal-50",
            )}
          >
            <Plus className="size-4" aria-hidden />
            {query.trim() ? `Create “${query.trim()}” as a new customer` : "Create new customer"}
          </button>
        </div>
      )}
    </div>
  );
}

function CreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: CustomerHit) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await createCustomerForQuote({
                first_name: String(formData.get("first_name") ?? ""),
                last_name: String(formData.get("last_name") ?? ""),
                company: String(formData.get("company") ?? ""),
                email: String(formData.get("email") ?? ""),
                phone: String(formData.get("phone") ?? ""),
              });
              if (result.ok) {
                onCreated(result.customer);
                onOpenChange(false);
              } else {
                setError(result.message);
              }
            })
          }
        >
          {error && <p className="text-body-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="first_name" required>
              <Input id="first_name" name="first_name" required autoFocus />
            </Field>
            <Field label="Last name" htmlFor="last_name">
              <Input id="last_name" name="last_name" />
            </Field>
          </div>
          <Field label="Company" htmlFor="company">
            <Input id="company" name="company" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Add customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerTab({
  initialCustomer,
  initialBilling,
}: {
  initialCustomer: CustomerHit | null;
  initialBilling: CustomerHit | null;
}) {
  const { setHeader, canEdit } = useBuilder();
  const [customer, setCustomer] = useState<CustomerHit | null>(initialCustomer);
  const [billing, setBilling] = useState<CustomerHit | null>(initialBilling);
  const [creatingFor, setCreatingFor] = useState<null | "primary" | "billing">(null);
  const [addBilling, setAddBilling] = useState(Boolean(initialBilling));

  function pickPrimary(hit: CustomerHit) {
    setCustomer(hit);
    setHeader({ customer_id: hit.id });
  }
  function pickBilling(hit: CustomerHit) {
    setBilling(hit);
    setHeader({ billing_customer_id: hit.id });
  }

  return (
    <div className="space-y-6">
      {/* grid-cols-1 rather than no template: an implicit column is sized to its
          longest unbreakable line, which pushed the cards past the panel edge. */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="quote-customer-heading" className="min-w-0 space-y-3">
          <h3 id="quote-customer-heading" className="text-body font-semibold text-ink">
            Customer
          </h3>
          {customer ? (
            <CustomerCard
              customer={customer}
              actionLabel="Change"
              canEdit={canEdit}
              onClear={() => {
                setCustomer(null);
                setHeader({ customer_id: null });
              }}
            />
          ) : canEdit ? (
            <CustomerSearch
              onPick={pickPrimary}
              onCreate={() => setCreatingFor("primary")}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-cloud px-4 py-5 text-body-sm text-ash">
              No customer on this quote yet.
            </p>
          )}
        </section>

        <section aria-labelledby="quote-billing-heading" className="min-w-0 space-y-3">
          <div className="flex min-h-6 items-center justify-between gap-3">
            <h3 id="quote-billing-heading" className="text-body font-semibold text-ink">
              Billing Contact
            </h3>
            {addBilling && !billing && (
              <Button variant="ghost" size="xs" onClick={() => setAddBilling(false)}>
                Cancel
              </Button>
            )}
          </div>
          {billing ? (
            <CustomerCard
              customer={billing}
              actionLabel="Remove"
              canEdit={canEdit}
              onClear={() => {
                setBilling(null);
                setHeader({ billing_customer_id: null });
                setAddBilling(false);
              }}
            />
          ) : addBilling ? (
            <CustomerSearch
              onPick={pickBilling}
              onCreate={() => setCreatingFor("billing")}
            />
          ) : (
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setAddBilling(true)}
              className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-cloud px-4 py-4 text-left transition-colors hover:border-fog hover:bg-mist disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plaster text-ash transition-colors group-hover:bg-teal-50 group-hover:text-teal-600">
                <User className="size-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-body-sm font-semibold text-teal-600">
                  <Plus className="size-3.5" aria-hidden />
                  Add Billing Contact
                </span>
                <span className="block text-[12px] text-ash">
                  Send the invoices to someone other than the customer.
                </span>
              </span>
            </button>
          )}
        </section>
      </div>

      {(customer || billing) && (
        <p className="flex items-center gap-2 text-[12px] text-slate">
          <Check className="size-3.5 shrink-0 text-teal-600" aria-hidden />
          {billing
            ? "Quote goes to the customer; invoices go to the billing contact."
            : "This customer receives the quote and the invoice."}
        </p>
      )}

      <CreateCustomerDialog
        open={creatingFor !== null}
        onOpenChange={(open) => !open && setCreatingFor(null)}
        onCreated={(hit) => {
          if (creatingFor === "billing") pickBilling(hit);
          else pickPrimary(hit);
          setCreatingFor(null);
        }}
      />
    </div>
  );
}
