"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectProvider, type Project } from "@/contexts/project-context";

type Props = {
  children: React.ReactNode;
};

function ProjectSwitcherInner({ children }: Props) {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const projectSlug = searchParams.get("project");

  useEffect(() => {
    fetch("/api/v1/projects", { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setProjects(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || projects.length === 0) {
    return <>{children}</>;
  }

  return (
    <ProjectProvider projects={projects} initialSlug={projectSlug}>
      {children}
    </ProjectProvider>
  );
}

export function ProjectSwitcher({ children }: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base-secondary)] flex items-center justify-center"><span className="text-[var(--text-base-secondary)]">Loading...</span></div>}>
      <ProjectSwitcherInner>{children}</ProjectSwitcherInner>
    </Suspense>
  );
}
