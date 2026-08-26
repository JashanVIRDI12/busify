"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The shareable link, kept deliberately short. Everything about embedding it,
 * what the form collects and what happens next lives on the setup guide.
 */
export function BookingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy manually.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Your quote request link</CardTitle>
          <CardDescription>
            Share it anywhere. Submissions land in Trip requests with the
            customer&rsquo;s details already filled in.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-bone bg-mist px-4 py-3">
            <Link2 className="size-4 shrink-0 text-ash" aria-hidden />
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-carbon">
              {url}
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              Copy
            </Button>
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink />
                Preview
              </a>
            </Button>
          </div>
        </div>

        <Link
          href="/settings/api"
          className="group flex items-center gap-3 rounded-xl border border-bone px-4 py-3.5 transition-colors duration-150 hover:border-cloud hover:bg-mist"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-body-sm font-semibold text-ink">
              How to add this to your website
            </span>
            <span className="block text-[12px] text-slate">
              Copy-paste snippets, what the form collects, and what happens next.
            </span>
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-ash transition-transform duration-150 group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </CardContent>
    </Card>
  );
}
