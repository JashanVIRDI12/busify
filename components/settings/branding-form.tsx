"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { updateBrandingAction } from "@/app/(dashboard)/settings/company-actions";
import { FormAlert } from "@/components/data/form-fields";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Organization = Tables<"organizations">;

/**
 * Brand colours and marks, used on the customer's copy of a quote and on the
 * checkout page. The preview beside the form is the point: a hex code means
 * nothing until you see it on the thing it will appear on.
 */
export function BrandingForm({
  organization,
  canEdit,
}: {
  organization: Organization;
  canEdit: boolean;
}) {
  const { state, formAction } = useActionForm(updateBrandingAction, {
    onSuccess: (result) => toast.success(result.message ?? "Saved"),
  });

  const [primary, setPrimary] = useState(organization.brand_primary_color ?? "");
  const [secondary, setSecondary] = useState(
    organization.brand_secondary_color ?? "",
  );
  const [logo, setLogo] = useState(organization.logo_url ?? "");
  const [favicon, setFavicon] = useState(organization.favicon_url ?? "");

  return (
    <form action={formAction} className="panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-subheading font-semibold text-ink">Brand Colors</h2>
          <p className="mt-1 max-w-md text-body-sm text-slate">
            Up to two colours and your marks. These are used on everything a
            customer sees.
          </p>
        </div>
        {canEdit && <SaveButton />}
      </div>

      <div className="mt-4">
        <FormAlert message={state.status === "error" ? state.message : undefined} />
      </div>

      <div className="mt-4 grid gap-8 xl:grid-cols-2">
        <fieldset disabled={!canEdit} className="space-y-4">
          <ColorField
            name="brand_primary_color"
            label="Primary Color (HEX)"
            value={primary}
            onChange={setPrimary}
            error={state.fieldErrors?.brand_primary_color?.[0]}
          />
          <ColorField
            name="brand_secondary_color"
            label="Secondary Color (HEX)"
            value={secondary}
            onChange={setSecondary}
            error={state.fieldErrors?.brand_secondary_color?.[0]}
          />

          <UploadField
            label="Logo"
            name="logo_url"
            bucket="organization-logos"
            organizationId={organization.id}
            value={logo}
            onChange={setLogo}
            canEdit={canEdit}
          />
          <UploadField
            label="Favicon"
            name="favicon_url"
            bucket="organization-logos"
            organizationId={organization.id}
            value={favicon}
            onChange={setFavicon}
            canEdit={canEdit}
          />
        </fieldset>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-body-sm text-slate">
              Branding Example — Quote PDF
            </p>
            <div className="panel-flat overflow-hidden">
              <div className="px-5 py-4 text-center">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt=""
                    className="mx-auto max-h-10 object-contain"
                  />
                ) : (
                  <p className="text-[11px] tracking-wide text-ash uppercase">
                    {organization.name}
                  </p>
                )}
              </div>

              <div
                className="px-4 py-2 text-[11px] font-semibold tracking-wide uppercase"
                style={{
                  backgroundColor: primary || "var(--plaster)",
                  color: primary ? "#fff" : "var(--carbon)",
                }}
              >
                Sample Header
              </div>

              <div className="space-y-3 px-4 py-3.5">
                {[
                  { label: "Pickup → Depart", when: "Mon, 2/4 · 8:00am" },
                  { label: "Dropoff", when: "Mon, 2/4 · 9:30am" },
                ].map((stop) => (
                  <div key={stop.label} className="flex justify-between gap-4">
                    <span className="flex gap-2 text-[12px]">
                      <span
                        className="flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-signal-white"
                        style={{ backgroundColor: secondary || primary || "var(--slate)" }}
                      >
                        1
                      </span>
                      <span>
                        <span className="block font-medium text-ink">Stop Name</span>
                        <span className="block text-ash">
                          40905 South Main Street
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[11.5px]">
                      <span className="block font-medium text-ink">
                        {stop.label}
                      </span>
                      <span className="block text-ash">{stop.when}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-body-sm text-slate">
              Branding Example — Checkout Page
            </p>
            <div className="flex items-center gap-2 rounded-t-lg border border-bone bg-mist px-3 py-2">
              {favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={favicon} alt="" className="size-4 rounded-sm object-cover" />
              ) : (
                <span
                  className="size-4 rounded-sm"
                  style={{ backgroundColor: primary || "var(--cloud)" }}
                />
              )}
              <span className="text-[12px] text-carbon">
                {organization.name} — Checkout
              </span>
              <X className="ml-auto size-3.5 text-ash" />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function ColorField({
  name,
  label,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          aria-label={label}
          className={cn(
            "h-11 flex-1 rounded-md border bg-signal-white px-3.5 text-body-sm text-ink outline-none",
            "placeholder:text-ash focus-visible:border-orange-400",
            error ? "border-destructive" : "border-cloud hover:border-fog",
          )}
        />

        {/* A native colour input, so picking is a real picker rather than a
            swatch that only reflects what was typed. */}
        <label
          className="size-11 shrink-0 cursor-pointer rounded-md border border-cloud"
          style={{ backgroundColor: valid ? value : "var(--signal-white)" }}
        >
          <input
            type="color"
            value={valid ? value : "#f97b41"}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            aria-label={`${label} picker`}
            className="size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      {error && (
        <p className="mt-1 text-[12px] text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Uploads straight to storage and keeps only the resulting public URL in the
 * form. The logos bucket is public, so no signing is needed to display them on
 * a customer's quote.
 */
function UploadField({
  label,
  name,
  bucket,
  organizationId,
  value,
  onChange,
  canEdit,
}: {
  label: string;
  name: string;
  bucket: string;
  organizationId: string;
  value: string;
  onChange: (next: string) => void;
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Images are limited to 2 MB.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
      const path = `${organizationId}/${name}-${Date.now()}-${safe}`;

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type || undefined, upsert: true });

      if (error) {
        toast.error("That image could not be uploaded.");
        return;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success(`${label} uploaded — remember to save`);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-body font-semibold text-ink">{label}</p>
      <input type="hidden" name={name} value={value} />

      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="h-10 max-w-40 rounded border border-bone object-contain"
          />
          {canEdit && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-[12.5px] font-medium text-destructive hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-teal-600 transition-colors hover:text-teal-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Upload {label}
            </button>
          </>
        )
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save
    </Button>
  );
}
