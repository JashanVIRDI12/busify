"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  QUOTE_PIPELINE_STATUSES,
  QUOTE_PRIORITIES,
} from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";

const NONE = "__none__";

const PIPELINE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUOTED: "Quoted",
  FOLLOW_UP: "Follow up",
  WON: "Won",
  LOST: "Lost",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[12px] font-medium text-ash">{label}</span>
      <div className="min-w-0 text-right">{children}</div>
    </div>
  );
}

export function BuilderSidebar({ createdAt }: { createdAt: string | null }) {
  const { state, setHeader, lookups, canEdit, timezone } = useBuilder();
  const { header } = state;
  const [showFiles, setShowFiles] = useState(true);
  const [addingReferral, setAddingReferral] = useState(false);
  const [addingTag, setAddingTag] = useState(false);

  return (
    <div className="space-y-5 text-body-sm">
      <div className="divide-y divide-bone">
        <Row label="Quote Status">
          <Select
            value={header.pipeline_status}
            onValueChange={(value) =>
              setHeader({ pipeline_status: value as typeof header.pipeline_status })
            }
            disabled={!canEdit}
          >
            <SelectTrigger size="sm" className="h-7 border-none px-2 font-semibold text-interactive shadow-none">
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
            <SelectTrigger size="sm" className="h-7 border-none px-2 shadow-none">
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
            <SelectTrigger size="sm" className="h-7 border-none px-2 shadow-none">
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
          <Input
            value={header.event_name ?? ""}
            onChange={(event) =>
              setHeader({ event_name: event.target.value || null })
            }
            disabled={!canEdit}
            placeholder="—"
            className="h-7 w-40 border-none px-2 text-right text-body-sm shadow-none"
          />
        </Row>

        <Row label="Created Date">
          <span className="text-slate">
            {createdAt ? formatDate(createdAt, timezone) : "—"}
          </span>
        </Row>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-ash">Referred By:</span>
          {header.referred_by && !addingReferral ? (
            <button
              type="button"
              className="text-body-sm text-ink hover:underline"
              onClick={() => canEdit && setAddingReferral(true)}
            >
              {header.referred_by}
            </button>
          ) : addingReferral || header.referred_by ? (
            <Input
              autoFocus
              defaultValue={header.referred_by ?? ""}
              disabled={!canEdit}
              className="h-7 flex-1 px-2 text-body-sm"
              onBlur={(event) => {
                setHeader({ referred_by: event.target.value.trim() || null });
                setAddingReferral(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          ) : (
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setAddingReferral(true)}
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-interactive disabled:opacity-50"
            >
              <Plus className="size-3.5" /> Add
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-ash">Tags:</span>
          {header.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    setHeader({ tags: header.tags.filter((t) => t !== tag) })
                  }
                  aria-label={`Remove ${tag}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
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
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setAddingTag(true)}
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-interactive disabled:opacity-50"
            >
              <Plus className="size-3.5" /> Add
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-bone pt-4">
        <button
          type="button"
          onClick={() => setShowFiles((open) => !open)}
          className="flex w-full items-center gap-2 text-body-sm font-semibold text-ink"
        >
          {showFiles ? (
            <ChevronUp className="size-4 text-ash" />
          ) : (
            <ChevronDown className="size-4 text-ash" />
          )}
          Files
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-normal text-ash">
            <FileText className="size-3.5" /> 0/5
          </span>
        </button>
        {showFiles && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 text-body-sm font-semibold text-interactive/60",
                  "cursor-not-allowed",
                )}
              >
                <Plus className="size-4" /> Add File
              </button>
            </TooltipTrigger>
            <TooltipContent>File uploads arrive in a later phase.</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
