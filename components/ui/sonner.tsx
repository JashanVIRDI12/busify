"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      style={
        {
          "--normal-bg": "var(--signal-white)",
          "--normal-text": "var(--ink-black)",
          "--normal-border": "var(--bone)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
