"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useProjectOptional } from "@/contexts/project-context";

const TABS = [
  { href: "/triggers", label: "Triggers" },
  { href: "/groups", label: "Groups" },
  { href: "/users", label: "Users" },
  { href: "/send", label: "Send" },
  { href: "/queue", label: "Queue" },
  { href: "/analytics", label: "Analytics" },
] as const;

export function ProjectTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectSlug = searchParams.get("project");
  const projectName = useProjectOptional()?.project?.name;

  if (!projectSlug) return null;

  const projectQuery = `?project=${encodeURIComponent(projectSlug)}`;

  return (
    <div className="border-b border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
      <div className="mx-auto w-full px-4 pt-3 md:px-8">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-base-secondary)]">Project</p>
        <h2 className="mt-0.5 text-lg font-semibold text-[var(--text-base-default)]">
          {projectName ?? projectSlug}
        </h2>
      </div>
      <nav className="mx-auto flex w-full gap-1 px-4 pb-0 md:px-8" aria-label="Project sections">
        {TABS.map((tab) => {
          const href = `${tab.href}${projectQuery}`;
          const isActive =
            pathname === tab.href ||
            pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-[var(--text-brand-default)]"
                  : "text-[var(--text-base-secondary)] hover:text-[var(--text-base-default)]"
              )}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--border-brand-default)]"
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
