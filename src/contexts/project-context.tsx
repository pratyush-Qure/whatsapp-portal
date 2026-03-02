"use client";

import { createContext, useContext, useCallback, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type ProjectContextValue = {
  project: Project | null;
  projectSlug: string | null;
  projects: Project[];
  setProject: (slug: string | null) => void;
  isLoading: boolean;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within ProjectProvider");
  }
  return ctx;
}

export function useProjectOptional() {
  return useContext(ProjectContext);
}

type ProjectProviderProps = {
  projects: Project[];
  initialSlug: string | null;
  children: React.ReactNode;
};

export function ProjectProvider({ projects, initialSlug, children }: ProjectProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentProject = initialSlug
    ? projects.find((p) => p.slug === initialSlug) ?? projects[0] ?? null
    : projects[0] ?? null;

  const setProject = useCallback(
    (slug: string | null) => {
      const next = slug ? projects.find((p) => p.slug === slug) : null;
      const nextSlug = next?.slug ?? "";
      startTransition(() => {
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        if (nextSlug) params.set("project", nextSlug);
        else params.delete("project");
        const q = params.toString();
        const base = pathname.split("?")[0];
        router.push(q ? `${base}?${q}` : base);
      });
    },
    [projects, pathname, router]
  );

  return (
    <ProjectContext.Provider
      value={{
        project: currentProject,
        projectSlug: currentProject?.slug ?? null,
        projects,
        setProject,
        isLoading: isPending,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
