"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { FilesPanel, type QuoteFile } from "@/components/quotes/builder/files-panel";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatStampDate } from "@/lib/datetime";

import {
  QUOTE_PIPELINE_STATUSES,
  QUOTE_PRIORITIES,
} from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";

const NONE = "__none__";

const PIPELINE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUOTED: "Sent",
  FOLLOW_UP: "Follow Up",
  WON: "Won",
  LOST: "Lost",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

/**
 * `Label: value` on one line, left-aligned. The values are live controls rather
 * than a read-only summary — this rail is where a quote's status actually gets
 * changed, so a dropdown that looks like text is the point.
 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="shrink-0 text-body-sm text-slate">{label}:</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** A select styled to read as inline text until you reach for it. */
const INLINE_TRIGGER =
  "h-7 w-auto max-w-full gap-1 border-none px-1 text-body-sm font-medium text-teal-600 shadow-none hover:bg-mist data-[placeholder]:font-normal data-[placeholder]:text-fog";

export function BuilderSidebar({
  createdAt,
  updatedAt,
  quoteId,
  organizationId,
  files,
}: {
  createdAt: string | null;
  updatedAt: string | null;
  quoteId: string;
  organizationId: string;
  files: QuoteFile[];
}) {
  const { state, setHeader, lookups, canEdit, timezone } = useBuilder();
  const { header } = state;
  const [addingReferral, setAddingReferral] = useState(false);
  const [addingTag, setAddingTag] = useState(false);

  return (
    <div className="space-y-4 text-body-sm">
      <div>
        <Row label="Quote Status">
          <Select
            value={header.pipeline_status}
            onValueChange={(value) =>
              setHeader({ pipeline_status: value as typeof header.pipeline_status })
            }
            disabled={!canEdit}
          >
            <SelectTrigger size="sm" className={INLINE_TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUOTE_PIPELINE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PIPELINE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Sales Rep">
          <Select
            value={header.sales_rep_id ?? NONE}
            onValueChange={(value) =>
              setHeader({ sales_rep_id: value === NONE ? null : value })
            }
            disabled={!canEdit}
          >
            <SelectTrigger size="sm" className={INLINE_TRIGGER}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {lookups.salesReps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Priority">
          <Select
            value={header.priority ?? NONE}
            onValueChange={(value) =>
              setHeader({
                priority: value === NONE ? null : (value as typeof header.priority),
              })
            }
            disabled={!canEdit}
          >
            <SelectTrigger size="sm" className={INLINE_TRIGGER}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {QUOTE_PRIORITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Event">
          <Select
            value={header.event_name ?? NONE}
            onValueChange={(value) =>
              setHeader({ event_name: value === NONE ? null : value })
            }
            disabled={!canEdit}
          >
            <SelectTrigger size="sm" className={INLINE_TRIGGER}>
              <SelectValue placeholder="--" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>--</SelectItem>
              {lookups.eventTypes.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Created Date">
          <span className="px-1 text-body-sm text-carbon">
            {createdAt ? formatStampDate(createdAt, timezone) : "--"}
          </span>
        </Row>

        <Row label="Last Activity">
          <span className="px-1 text-body-sm text-carbon">
            {updatedAt ? formatStampDate(updatedAt, timezone) : "--"}
          </span>
        </Row>

        <Row label="Referred By">
          {addingReferral || (header.referred_by && addingReferral) ? (
            <Input
              autoFocus
              defaultValue={header.referred_by ?? ""}
              disabled={!canEdit}
              className="h-7 px-2 text-body-sm"
              onBlur={(event) => {
                setHeader({ referred_by: event.target.value.trim() || null });
                setAddingReferral(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setAddingReferral(false);
              }}
            />
          ) : header.referred_by ? (
            <button
              type="button"
              disabled={!canEdit}
              className="px-1 text-body-sm text-carbon hover:underline"
              onClick={() => setAddingReferral(true)}
            >
              {header.referred_by}
            </button>
          ) : (
            <AddButton disabled={!canEdit} onClick={() => setAddingReferral(true)} />
          )}
        </Row>

        <div className="flex flex-wrap items-center gap-1.5 py-[3px]">
          <span className="shrink-0 text-body-sm text-slate">Tags:</span>
          {header.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11.5px] font-medium text-teal-700"
            >
              {tag}
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    setHeader({ tags: header.tags.filter((item) => item !== tag) })
                  }
                  aria-label={`Remove ${tag}`}
                  className="text-teal-600/70 hover:text-teal-700"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
          {addingTag ? (
            <Input
              autoFocus
              className="h-7 w-28 px-2 text-body-sm"
              onBlur={() => setAddingTag(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const value = event.currentTarget.value.trim();
                  if (value && !header.tags.includes(value)) {
                    setHeader({ tags: [...header.tags, value] });
                  }
                  event.currentTarget.value = "";
                }
                if (event.key === "Escape") setAddingTag(false);
              }}
            />
          ) : (
            <AddButton disabled={!canEdit} onClick={() => setAddingTag(true)} />
          )}
        </div>
      </div>

      <FilesPanel
        quoteId={quoteId}
        organizationId={organizationId}
        files={files}
        canEdit={canEdit}
      />
    </div>
  );
}

function AddButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-0.5 px-1 text-body-sm font-medium text-teal-600 transition-colors hover:text-teal-700 disabled:opacity-50"
    >
      <Plus className="size-3.5" /> Add
    </button>
  );
}
