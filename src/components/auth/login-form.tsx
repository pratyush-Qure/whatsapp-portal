"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginFormData) {
    if (!isSupabaseConfigured()) {
      setError("root", {
        message:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env",
      });
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (signInError) {
      setError("root", { message: signInError.message });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextPath = params.get("next") || "/";
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col items-center gap-4">
      <div className="w-full space-y-1">
        <label
          className="block text-center text-sm text-[var(--text-base-secondary)]"
          htmlFor="email"
        >
          Email <span className="text-[var(--text-danger-default)]">*</span>
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          placeholder="you@example.com"
          className="h-11 w-full rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] px-4 text-sm text-[var(--text-base-default)] placeholder:text-[var(--text-disabled-default)] focus:border-[var(--border-brand-default)] focus:outline-none focus:ring-1 focus:ring-[var(--border-brand-default)]"
        />
        {errors.email && (
          <p className="text-center text-xs text-[var(--text-danger-default)]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="w-full space-y-1">
        <label
          className="block text-center text-sm text-[var(--text-base-secondary)]"
          htmlFor="password"
        >
          Password <span className="text-[var(--text-danger-default)]">*</span>
        </label>
        <input
          id="password"
          type="password"
          {...register("password")}
          placeholder="••••••••"
          className="h-11 w-full rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-secondary)] px-4 text-sm text-[var(--text-base-default)] placeholder:text-[var(--text-disabled-default)] focus:border-[var(--border-brand-default)] focus:outline-none focus:ring-1 focus:ring-[var(--border-brand-default)]"
        />
        {errors.password && (
          <p className="text-center text-xs text-[var(--text-danger-default)]">
            {errors.password.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p className="w-full rounded-lg bg-[var(--bg-danger-tertiary)] px-4 py-2 text-center text-sm text-[var(--text-danger-default)]">
          {errors.root.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full cursor-pointer rounded-lg bg-[var(--bg-brand-default)] px-4 text-sm font-medium text-[var(--text-brand-on-brand)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
