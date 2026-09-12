"use client";

import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, FileText, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  deleteQuoteFileAction,
  quoteFileUrlAction,
  registerQuoteFileAction,
} from "@/app/(dashboard)/quotes/file-actions";
import {
  MAX_QUOTE_FILES,
  MAX_QUOTE_FILE_BYTES,
} from "@/lib/quotes/limits";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type QuoteFile = {
  id: string;
  name: string;
  size_bytes: number;
};

/**
 * The attachments panel in the builder's left rail.
 *
 * Bytes go browser-to-storage; only the resulting path is sent to the server.
 * Storage policies scope writes to the caller's tenant prefix, which is why the
 * path is built from the organization id here rather than being chosen freely.
 */
export function FilesPanel({
  quoteId,
  organizationId,
  files,
  canEdit,
}: {
  quoteId: string;
  organizationId: string;
  files: QuoteFile[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const full = files.length >= MAX_QUOTE_FILES;

  async function upload(file: File) {
    if (file.size > MAX_QUOTE_FILE_BYTES) {
      toast.error(
        `Files are limited to ${MAX_QUOTE_FILE_BYTES / (1024 * 1024)} MB.`,
      );
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      // Generated name, original name kept in the row: two files called
      // "contract.pdf" must not overwrite each other.
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${organizationId}/${quoteId}/${crypto.randomUUID()}-${safe}`;

      const { error } = await supabase.storage
        .from("quote-files")
        .upload(path, file, { contentType: file.type || undefined });

      if (error) {
        toast.error("That file could not be uploaded.");
        return;
      }

      const result = await registerQuoteFileAction({
        quote_id: quoteId,
        name: file.name,
        storage_path: path,
        size_bytes: file.size,
        content_type: file.type || null,
      });

      if (result.ok) {
        toast.success(`Attached ${file.name}`);
      } else {
        // Roll the object back so a rejected row does not leave a stray file.
        await supabase.storage.from("quote-files").remove([path]);
        toast.error(result.message);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="border-t border-bone pt-4">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 text-body-sm font-semibold text-ink"
      >
        {open ? (
          <ChevronUp className="size-4 text-ash" />
        ) : (
          <ChevronDown className="size-4 text-ash" />
        )}
        Files
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-normal text-ash">
          <FileText className="size-3.5" />
          {files.length}/{MAX_QUOTE_FILES}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-mist"
            >
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    const result = await quoteFileUrlAction(file.id);
                    if (result.ok) window.open(result.data.url, "_blank");
                    else toast.error(result.message);
                  })
                }
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-body-sm text-teal-600 hover:underline">
                  {file.name}
                </span>
                <span className="text-[11px] text-ash">
                  {formatBytes(file.size_bytes)}
                </span>
              </button>

              {canEdit && (
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteQuoteFileAction(file.id);
                      if (!result.ok) toast.error(result.message);
                    })
                  }
                  className="text-ash opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}

          {canEdit && (
            <>
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
              <button
                type="button"
                disabled={uploading || pending || full}
                onClick={() => inputRef.current?.click()}
                title={full ? `Limit is ${MAX_QUOTE_FILES} files` : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 text-body-sm font-semibold text-teal-600",
                  "transition-colors hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add File
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
