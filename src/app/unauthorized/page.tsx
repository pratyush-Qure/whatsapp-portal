export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-7xl items-center justify-center px-4 py-6 md:px-8">
      <section className="w-full max-w-lg rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
        <h1 className="text-xl font-semibold">Unauthorized</h1>
        <p className="mt-2 text-sm text-[var(--text-base-secondary)]">
          Your account is authenticated but does not have the required privileges for this action.
          Contact an administrator to request role access.
        </p>
      </section>
    </main>
  );
}
