"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

/**
 * A copyable snippet. Falls back to a clear instruction rather than failing
 * silently — the clipboard API is blocked on plain HTTP in some browsers, which
 * is exactly where a self-hosted operator will be testing.
 */
export function CopyBlock({
  code,
  label,
  language = "html",
  className,
}: {
  code: string;
  label?: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the text and copy manually.");
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-bone", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-bone bg-mist px-4 py-2.5">
        <p className="meta-label">{label ?? language}</p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold text-carbon transition-colors hover:bg-ink/6"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-signal-white px-4 py-3.5">
        <code className="font-mono text-[12px] leading-relaxed whitespace-pre text-carbon">
          {code}
        </code>
      </pre>
    </div>
  );
}
