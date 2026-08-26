"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsOf } from "@/lib/utils";

type UserMenuProps = {
  name: string | null;
  email: string;
  roleLabel: string;
};

export function UserMenu({ name, email, roleLabel }: UserMenuProps) {
  const display = name?.trim() || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 pr-2 pl-1.5"
          aria-label="Account menu"
        >
          <Avatar className="size-6">
            <AvatarFallback className="text-[0.625rem]">
              {initialsOf(...display.split(/[\s@.]+/))}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
            {display}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{display}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {email}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/organization">
            <Settings />
            Organization settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void signOutAction();
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
