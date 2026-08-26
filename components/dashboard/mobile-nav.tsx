"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileNav({ header }: { header: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" aria-hidden />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Logo />
        </div>
        {header}
        <div className="flex-1 overflow-y-auto">
          {/* Closing on link click keeps the drawer from lingering over the
              page it just navigated to. */}
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
