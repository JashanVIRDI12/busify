"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toMajor } from "@/lib/pricing";
import { formatDate } from "@/lib/datetime";
import { formatMoney } from "@/lib/utils";
import type { PaymentMethodKind } from "@/types/database";

import { useBuilder } from "./builder-context";
import { NumericInput } from "./numeric-input";

const NONE = "__none__";

const METHOD_LABELS: Record<PaymentMethodKind, string> = {
  CARD: "Card",
  BANK: "Bank",
  CHECK: "Check",
  WIRE: "Wire",
  OTHER: "Other",
};

function PaymentTermsTable() {
  const { state, computed, currency, setTrip, timezone, canEdit } = useBuilder();
  const money = (major: number) => formatMoney(major, currency, { precise: true });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-body-sm">
        <thead>
          <tr className="border-b border-bone text-left text-[11px] font-semibold tracking-wide text-ash uppercase">
            <th className="py-2 pr-3">Trip</th>
            <th className="py-2 pr-3">Pickup date</th>
            <th className="py-2 pr-3 text-right">Trip total</th>
            <th className="py-2 pr-3 text-right">Due now %</th>
            <th className="py-2 pr-3 text-right">Due now $</th>
            <th className="py-2 pr-3 text-right">Due later $</th>
            <th className="py-2">Balance due date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bone">
          {state.trips.map((trip) => {
            const result = computed.byTrip[trip.id];
            const pickupDate = trip.stops[0]?.stop_date ?? trip.departing_date;
            return (
              <tr key={trip.id}>
                <td className="py-2.5 pr-3 font-medium text-ink">{trip.name}</td>
                <td className="py-2.5 pr-3 text-slate">
                  {pickupDate
                    ? formatDate(`${pickupDate}T00:00:00Z`, timezone)
                    : "—"}
                </td>
                <td className="tabular py-2.5 pr-3 text-right">
                  {money(toMajor(result?.total ?? 0))}
                </td>
                <td className="py-2.5 pr-3">
                  <NumericInput
                    className="h-8 w-20 text-right"
                    suffix="%"
                    value={trip.due_now_percent}
                    onValueChange={(value) =>
                      setTrip(trip.id, {
                        due_now_percent: value ?? 0,
                        due_now_amount: null,
                      })
                    }
                  />
                </td>
                <td className="py-2.5 pr-3">
                  <NumericInput
                    className="h-8 w-24 text-right"
                    prefix="$"
                    nullable
                    value={
                      trip.due_now_amount ?? toMajor(result?.dueNow ?? 0)
                    }
                    onValueChange={(value) =>
                      setTrip(trip.id, { due_now_amount: value })
                    }
                  />
                </td>
                <td className="tabular py-2.5 pr-3 text-right text-slate">
                  {money(toMajor(result?.dueLater ?? 0))}
                </td>
                <td className="py-2.5">
                  <Input
                    type="date"
                    className="h-8 w-40"
                    value={trip.balance_due_date ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setTrip(trip.id, {
                        balance_due_date: e.target.value || null,
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
          <tr className="font-semibold text-ink">
            <td className="py-2.5 pr-3" colSpan={2}>
              Quote total
            </td>
            <td className="tabular py-2.5 pr-3 text-right">
              {money(toMajor(computed.rollup.total))}
            </td>
            <td />
            <td className="tabular py-2.5 pr-3 text-right">
              {money(toMajor(computed.rollup.dueNow))}
            </td>
            <td className="tabular py-2.5 pr-3 text-right">
              {money(toMajor(computed.rollup.dueLater))}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ContractTermsDialog() {
  const { state, setHeader, lookups, canEdit } = useBuilder();
  const [open, setOpen] = useState(false);
  const current = lookups.contractTerms.find(
    (entry) => entry.id === state.header.contract_terms_id,
  );

  return (
    <div className="flex items-center gap-2">
      <Select
        value={state.header.contract_terms_id ?? NONE}
        onValueChange={(value) =>
          setHeader({ contract_terms_id: value === NONE ? null : value })
        }
        disabled={!canEdit}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Choose terms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No contract terms</SelectItem>
          {lookups.contractTerms.length === 0 ? (
            <SelectEmpty
              message="No contract terms yet. These are what the customer agrees to at checkout."
              href="/settings/templates"
              linkLabel="Write your terms"
            />
          ) : (
            lookups.contractTerms.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {current && (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
          <span className="sr-only">Preview terms</span>
          ⋯
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{current?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-body-sm whitespace-pre-wrap text-slate">
            {current?.body || "No terms text recorded."}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PaymentTab() {
  const { state, setHeader, setPaymentMethod, canEdit } = useBuilder();
  const { header } = state;

  return (
    <div className="space-y-8">
      {/* Payment terms */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-ink">
            Payment Terms <span className="text-destructive">*</span>
          </h3>
          <label className="flex items-center gap-2 text-body-sm text-slate">
            <Switch
              checked={header.allow_full_card_payment}
              disabled={!canEdit}
              onCheckedChange={(checked) =>
                setHeader({ allow_full_card_payment: checked })
              }
            />
            Allow payment in full during checkout when paying with card
          </label>
        </div>
        <PaymentTermsTable />
        <label className="flex items-center gap-2 text-body-sm text-slate">
          <Switch
            checked={header.allow_instant_booking}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              setHeader({ allow_instant_booking: checked })
            }
          />
          Allow customer to instantly book this quote online
        </label>
      </section>

      {/* Payment methods */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-body font-semibold text-ink">
            Accepted Payment Methods <span className="text-destructive">*</span>
          </h3>
          <label className="flex items-center gap-2 text-body-sm text-slate">
            <Switch
              checked={header.allow_pay_later}
              disabled={!canEdit}
              onCheckedChange={(checked) => setHeader({ allow_pay_later: checked })}
            />
            Enable &ldquo;Pay Later&rdquo; to allow online booking without a payment
            method
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-body-sm">
            <thead>
              <tr className="border-b border-bone text-left text-[11px] font-semibold tracking-wide text-ash uppercase">
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Online processing</th>
                <th className="py-2 pr-3">Processing fee</th>
                <th className="py-2">Note &amp; instructions for the customer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bone">
              {state.paymentMethods.map((method) => (
                <tr key={method.method}>
                  <td className="py-2.5 pr-3">
                    <label className="flex items-center gap-2 font-medium text-ink">
                      <input
                        type="checkbox"
                        checked={method.enabled}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setPaymentMethod(method.method, {
                            enabled: e.target.checked,
                          })
                        }
                      />
                      {METHOD_LABELS[method.method]}
                    </label>
                  </td>
                  <td className="py-2.5 pr-3 text-slate">
                    {method.method === "CARD" || method.method === "BANK" ? (
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={method.online_processing}
                          disabled={!canEdit}
                          onCheckedChange={(checked) =>
                            setPaymentMethod(method.method, {
                              online_processing: checked,
                            })
                          }
                        />
                        {method.online_processing ? "Enabled" : "Off"}
                      </label>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <NumericInput
                      className="h-8 w-24 text-right"
                      suffix="%"
                      value={method.processing_fee_percent}
                      onValueChange={(value) =>
                        setPaymentMethod(method.method, {
                          processing_fee_percent: value ?? 0,
                        })
                      }
                    />
                  </td>
                  <td className="py-2.5">
                    <Input
                      className="h-8"
                      placeholder="e.g. wire account number, e-transfer address"
                      value={method.customer_note ?? ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setPaymentMethod(method.method, {
                          customer_note: e.target.value || null,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="flex items-center gap-2 text-body-sm text-slate">
          <Switch
            checked={header.po_only}
            disabled={!canEdit}
            onCheckedChange={(checked) => setHeader({ po_only: checked })}
          />
          Enable PO Number as the only payment method
          {header.po_only && (
            <Input
              className="h-8 w-48"
              placeholder="PO Number"
              value={header.po_number ?? ""}
              onChange={(e) =>
                setHeader({ po_number: e.target.value || null })
              }
            />
          )}
        </label>
      </section>

      {/* Payment policy */}
      <section className="space-y-2">
        <h3 className="text-body font-semibold text-ink">Payment Policy</h3>
        <Textarea
          rows={4}
          value={header.payment_policy ?? ""}
          disabled={!canEdit}
          placeholder="Payment or cancellation terms the customer sees at checkout. This does not replace your terms of service."
          onChange={(e) =>
            setHeader({ payment_policy: e.target.value || null })
          }
        />
      </section>

      {/* Expiry + signature */}
      <section className="space-y-3">
        <label className="flex flex-wrap items-center gap-2 text-body-sm text-slate">
          <Switch
            checked={header.expiry_days !== null}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              setHeader({ expiry_days: checked ? 14 : null })
            }
          />
          This quote will expire
          {header.expiry_days !== null && (
            <>
              <NumericInput
                className="h-8 w-16 text-center"
                value={header.expiry_days}
                onValueChange={(value) =>
                  setHeader({
                    expiry_days: Math.max(1, Math.round(value ?? 1)),
                  })
                }
              />
              <span>days from the</span>
              <Select
                value={header.expiry_anchor}
                onValueChange={(value) =>
                  setHeader({
                    expiry_anchor: value as typeof header.expiry_anchor,
                  })
                }
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LAST_SENT">last</SelectItem>
                  <SelectItem value="FIRST_SENT">first</SelectItem>
                </SelectContent>
              </Select>
              <span>sent date</span>
            </>
          )}
        </label>

        <label className="flex items-center gap-2 text-body-sm text-slate">
          <Switch
            checked={header.require_signature}
            disabled={!canEdit}
            onCheckedChange={(checked) =>
              setHeader({ require_signature: checked })
            }
          />
          Require signature upon checkout
        </label>
      </section>

      {/* Overage + contract terms */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-body font-semibold text-ink">Overage Rate</h3>
          <div className="flex gap-2">
            <Select
              value={header.overage_basis ?? NONE}
              onValueChange={(value) =>
                setHeader({
                  overage_basis:
                    value === NONE
                      ? null
                      : (value as typeof header.overage_basis),
                })
              }
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue placeholder="Overage rate type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                <SelectItem value="HOURLY">Per hour</SelectItem>
                <SelectItem value="MILEAGE">Per km</SelectItem>
                <SelectItem value="DAILY">Per day</SelectItem>
              </SelectContent>
            </Select>
            <NumericInput
              prefix="$"
              nullable
              value={header.overage_rate}
              onValueChange={(value) => setHeader({ overage_rate: value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-body font-semibold text-ink">
            Contract Terms <span className="text-destructive">*</span>
          </h3>
          <ContractTermsDialog />
        </div>
      </section>
    </div>
  );
}
