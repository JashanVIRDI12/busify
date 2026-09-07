"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Building2, Check, Mail, Phone, Plus, Search, User, X } from "lucide-react";

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

function CustomerCard({
  customer,
  onClear,
  canEdit,
  label,
}: {
  customer: CustomerHit;
  onClear: () => void;
  canEdit: boolean;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-bone bg-signal-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-ash uppercase">
          {customer.company ? <Building2 className="size-3.5" /> : <User className="size-3.5" />}
          {label}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onClear}
            className="text-ash hover:text-ink"
            aria-label="Remove"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-body font-semibold text-ink">{customer.name}</p>
      {customer.company && (
        <p className="text-body-sm text-slate">{customer.company}</p>
      )}
      <div className="mt-2 space-y-1 text-body-sm text-slate">
        {customer.email && (
          <p className="flex items-center gap-2">
            <Mail className="size-3.5 text-ash" />
            {customer.email}
          </p>
        )}
        {customer.phone && (
          <p className="flex items-center gap-2">
            <Phone className="size-3.5 text-ash" />
            {customer.phone}
          </p>
        )}
      </div>
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
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchCustomersForQuote(query));
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
      <div className="flex items-center gap-2 rounded-xl border border-cloud bg-signal-white px-3.5">
        <Search className="size-4 shrink-0 text-ash" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search for name, email, or phone number"
          className="h-11 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ash"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 max-h-80 w-full overflow-y-auto rounded-xl border border-bone bg-signal-white p-1.5 shadow-(--shadow-subtle)">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-body-sm text-ash">
              {query ? "No matches." : "Start typing to search customers."}
            </p>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onPick(customer);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-mist"
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
            type="button"
            onClick={onCreate}
            className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-bone px-3 py-2.5 text-body-sm font-semibold text-teal-600"
          >
            <Plus className="size-4" /> Create new customer
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
  const { state, setHeader, canEdit } = useBuilder();
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
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4 rounded-lg border border-bone bg-mist p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-ink">Select Company or Contact</h3>
        </div>
        {customer ? (
          <CustomerCard
            customer={customer}
            label="Customer"
            canEdit={canEdit}
            onClear={() => {
              setCustomer(null);
              setHeader({ customer_id: null });
            }}
          />
        ) : (
          <CustomerSearch
            onPick={pickPrimary}
            onCreate={() => setCreatingFor("primary")}
          />
        )}
      </div>

      <div className="space-y-4">
        {addBilling || billing ? (
          <div className="space-y-3 rounded-lg border border-bone bg-mist p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-body font-semibold text-ink">Billing Contact</h3>
              {!billing && (
                <button
                  type="button"
                  onClick={() => setAddBilling(false)}
                  className="text-ash hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {billing ? (
              <CustomerCard
                customer={billing}
                label="Billing"
                canEdit={canEdit}
                onClear={() => {
                  setBilling(null);
                  setHeader({ billing_customer_id: null });
                  setAddBilling(false);
                }}
              />
            ) : (
              <CustomerSearch
                onPick={pickBilling}
                onCreate={() => setCreatingFor("billing")}
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setAddBilling(true)}
            className={cn(
              "inline-flex items-center gap-2 text-body-sm font-semibold text-teal-600",
              "disabled:opacity-50",
            )}
          >
            <Plus className="size-4" /> Add Billing Contact
          </button>
        )}

        {(customer || billing) && (
          <p className="flex items-center gap-2 text-[12px] text-ash">
            <Check className="size-3.5 text-teal-600" />
            {billing
              ? "Quote goes to the customer; invoices go to the billing contact."
              : "This customer receives the quote and the invoice."}
          </p>
        )}
        <input type="hidden" value={state.header.customer_id ?? ""} readOnly />
      </div>

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
