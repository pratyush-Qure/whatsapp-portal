"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthStatus } from "@/components/auth/auth-status";
import { ProjectSelector } from "@/components/layout/project-selector";
import { ProjectTabs } from "@/components/layout/project-tabs";

type NavItem = {
  href: string;
  label: string;
};

type Props = {
  baseNavItems: NavItem[];
  children: React.ReactNode;
};

export function AppShell({ baseNavItems, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const hasProject = Boolean(projectParam);
  const [collapsed, setCollapsed] = useState(false);

  const isLoginPage = pathname.startsWith("/login");
  const isUnauthorizedPage = pathname.startsWith("/unauthorized");
  const showSidebar = !isLoginPage && !isUnauthorizedPage;

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isUnauthorizedPage) {
    return (
      <div className="min-h-screen bg-[var(--bg-base-secondary)] text-[var(--text-base-default)]">
        <header className="flex h-16 cursor-default items-center justify-between border-b border-[var(--border-base-default)] bg-[var(--bg-base-default)] px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Qure.ai"
              width={120}
              height={32}
              className="h-8 w-auto object-contain object-left"
              priority
            />
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-base-secondary)]">
              Messaging
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthStatus />
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  const sidebarWidth = collapsed ? "w-20" : "w-64";
  const sidebarWidthMargin = collapsed ? "ml-20" : "ml-64";

  return (
    <div className="min-h-screen bg-[var(--bg-base-secondary)] text-[var(--text-base-default)]">
      <div className="flex">
        <aside
          className={cn(
            "fixed left-0 top-0 z-10 h-screen flex-shrink-0 overflow-y-auto border-r border-[var(--border-base-default)] bg-[var(--bg-base-default)] transition-all duration-200",
            sidebarWidth
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-[var(--border-base-default)] px-3">
            <div className={cn("flex items-center gap-2 overflow-hidden transition-all", collapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
              <Image
                src="/logo.svg"
                alt="Qure.ai"
                width={120}
                height={32}
                className="h-8 w-auto object-contain object-left"
                priority
              />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-base-secondary)]">
                Messaging
              </span>
            </div>
            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => setCollapsed((prev) => !prev)}>
              {collapsed ? ">" : "<"}
            </Button>
          </div>

          <nav className="p-3">
            <div className="space-y-1">
              <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-[var(--text-base-secondary)]">
                Global
              </p>
              {baseNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-10 cursor-pointer items-center rounded-md px-3 text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-brand-default)]",
                      isActive
                        ? "bg-[var(--bg-brand-tertiary)] text-[var(--text-brand-default)] shadow-sm"
                        : "text-[var(--text-base-default)] hover:bg-[var(--bg-base-tertiary)] hover:text-[var(--text-brand-default)]"
                    )}
                  >
                    <span className={cn(collapsed ? "sr-only" : "inline")}>{item.label}</span>
                    <span className={cn(collapsed ? "mx-auto inline text-xs" : "hidden")}>
                      {item.label.charAt(0)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        <section className={cn("min-h-screen flex-1 transition-[margin] duration-200", sidebarWidthMargin)}>
          <header className="border-b border-[var(--border-base-default)] bg-[var(--bg-base-default)]">
            <div className="mx-auto flex h-16 w-full items-center justify-end gap-3 px-4 md:px-8">
              <Link
                href="/projects?open=create"
                className="rounded-md px-3 py-2 text-sm font-medium text-[var(--text-base-default)] hover:bg-[var(--bg-base-tertiary)] hover:text-[var(--text-brand-default)]"
              >
                New project
              </Link>
              <ProjectSelector />
              <ThemeToggle />
              <AuthStatus />
            </div>
          </header>
          {hasProject && <ProjectTabs />}
          <main>{children}</main>
        </section>
      </div>
    </div>
  );
}
