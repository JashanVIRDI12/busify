"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { landingPath } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations/auth";

/**
 * An explicit post-login destination, or null to fall back to the user's role
 * landing page. Only ever a path on this origin.
 */
function explicitNext(next: unknown): string | null {
  if (typeof next !== "string" || next === "") return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) return formError(error.message);

  // Session present means email confirmation is disabled on this project, so
  // the user is already signed in and can go straight to onboarding.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/onboarding");
  }

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately vague: never reveal whether an address has an account.
    return formError(
      error.message === "Invalid login credentials"
        ? "That email and password combination did not work."
        : error.message,
    );
  }

  revalidatePath("/", "layout");
  redirect(explicitNext(formData.get("next")) ?? (await landingPath()));
}

export async function signOutAction(redirectTo?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(redirectTo === "/driver/login" ? "/driver/login" : "/login");
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/confirm?type=recovery&next=/reset-password`,
  });

  if (error) return formError(error.message);

  // Same response whether or not the account exists.
  return formSuccess(
    "If that address has an account, a password reset link is on its way.",
  );
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return formError(
      "This reset link has expired. Request a new one and try again.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return formError(error.message);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/onboarding` },
  });

  if (error) return formError(error.message);

  return formSuccess("Verification email sent. Check your inbox.");
}
