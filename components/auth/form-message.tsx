import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;

  const isError = state.status === "error";

  return (
    <Alert variant={isError ? "destructive" : "success"} className="mb-5">
      {isError ? <AlertCircle /> : <CheckCircle2 />}
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}
