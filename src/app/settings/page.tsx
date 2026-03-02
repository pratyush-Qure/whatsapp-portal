import Link from "next/link";

type Props = { searchParams: Promise<{ project?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { project: projectSlug } = await searchParams;
  const projectQuery = projectSlug ? `?project=${encodeURIComponent(projectSlug)}` : "";
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-8">
      <section className="rounded-lg border border-[var(--border-base-default)] bg-[var(--bg-base-default)] p-6">
        <h1 className="text-xl font-semibold text-[var(--text-base-default)]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--text-base-secondary)]">
          Application settings.
        </p>
        <div className="mt-4 space-y-2">
          <Link
            href={`/settings/twilio${projectQuery}`}
            className="block rounded-md border border-[var(--border-base-default)] px-4 py-2 text-sm hover:bg-[var(--bg-base-tertiary)]"
          >
            Twilio Accounts
          </Link>
        </div>
      </section>
    </main>
  );
}
