import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base-secondary)] px-4 py-8">
      <Image
        src="/logo.svg"
        alt="Qure.ai"
        width={140}
        height={36}
        className="mb-6 h-9 w-auto object-contain"
        priority
      />
      <section className="w-full max-w-sm rounded-xl border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-[var(--text-base-default)]">Welcome</h1>
          <p className="mt-2 text-sm text-[var(--text-base-secondary)]">
            Sign in to access the portal
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
