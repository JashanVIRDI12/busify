import type { ReactNode } from "react";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="rounded-2xl border border-bone bg-signal-white p-8 shadow-(--shadow-layered)">
      <div className="space-y-2">
        <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.035em] text-onyx">
          {title}
        </h1>
        <p className="text-body-sm text-pretty text-slate">{description}</p>
      </div>
      <div className="mt-7">{children}</div>
      {footer && (
        <div className="mt-7 border-t border-bone pt-6 text-center text-body-sm text-slate">
          {footer}
        </div>
      )}
    </div>
  );
}
