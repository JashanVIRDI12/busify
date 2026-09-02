"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BusFront,
  Inbox,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "busify:welcome-seen";

const SLIDES = [
  {
    icon: BusFront,
    eyebrow: "Welcome",
    title: "This is your operations board.",
    body: "Fleet, drivers, customers, requests, quotes, bookings and dispatch — one system instead of a spreadsheet and an inbox.",
    aside:
      "Start by adding a vehicle type. Your per-kilometre and hourly rates live there, and quoting reads from them.",
  },
  {
    icon: Inbox,
    eyebrow: "How work flows",
    title: "Request → quote → booking → trip.",
    body: "An enquiry arrives, you check what is genuinely free, you send a price or accept it outright, then you dispatch a coach and driver.",
    aside:
      "Quotes apply GST or HST at the rate for the province the trip starts in. Set your province under Settings.",
  },
  {
    icon: BookOpen,
    eyebrow: "Getting work in",
    title: "One link takes enquiries from your website.",
    body: "Share it, or paste a button onto your site. Submissions land in Trip requests with the customer's details already filled in.",
    aside: "Find it any time under API in the sidebar.",
  },
  {
    icon: Sparkles,
    eyebrow: "The assistant",
    title: "Ask AI, bottom-right of every page.",
    body: "It reads your live data — never guesses — and can make changes once you confirm them. It cannot delete anything or email anyone.",
    aside: "Try: “Brief me on today”.",
  },
] as const;

/**
 * First-run tour.
 *
 * Dismissal is stored in localStorage, so it is remembered per browser rather
 * than per account — clearing site data or signing in elsewhere shows it again.
 * A column on the profile would be the durable fix; this avoids a migration for
 * something that is only cosmetic if it repeats.
 */
function subscribe(onChange: () => void) {
  // Another tab dismissing the tour should close it here too.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function hasSeenTour() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Blocked storage: treat as seen so the tour never becomes un-dismissable.
    return true;
  }
}

export function WelcomeTour() {
  // useSyncExternalStore rather than an effect: localStorage is browser-only,
  // and this is the API built for a store whose server snapshot differs from
  // the client's. The server always reports "seen", so nothing renders during
  // SSR and there is no hydration mismatch.
  const seen = useSyncExternalStore(subscribe, hasSeenTour, () => true);

  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);

  const open = !seen && !dismissed;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do; worst case it shows again next visit.
    }
    setDismissed(true);
  }

  const slide = SLIDES[index]!;
  const Icon = slide.icon;
  const isLast = index === SLIDES.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogTitle className="sr-only">Welcome to VIABUS</DialogTitle>
        <DialogDescription className="sr-only">
          A short tour of how the product works.
        </DialogDescription>

        <div>
          <span className="flex size-11 items-center justify-center rounded-full bg-ink text-signal-white">
            <Icon className="size-5" aria-hidden />
          </span>

          <p className="meta-label mt-5">{slide.eyebrow}</p>
          <h2 className="mt-2 font-display text-[26px] leading-tight font-extrabold tracking-[-0.035em] text-balance text-onyx">
            {slide.title}
          </h2>
          <p className="mt-3 text-body text-pretty text-slate">{slide.body}</p>

          <p className="mt-5 rounded-xl border border-bone bg-mist px-4 py-3 text-body-sm text-pretty text-carbon">
            {slide.aside}
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" aria-hidden>
            {SLIDES.map((entry, i) => (
              <span
                key={entry.title}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === index ? "w-6 bg-ink" : "w-1.5 bg-cloud",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIndex((value) => value - 1)}
              >
                <ArrowLeft />
                Back
              </Button>
            )}

            {isLast ? (
              <>
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  Close
                </Button>
                <Button size="sm" asChild onClick={dismiss}>
                  <Link href="/guide">
                    Read the guide
                    <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  Skip
                </Button>
                <Button size="sm" onClick={() => setIndex((value) => value + 1)}>
                  Next
                  <ArrowRight />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
