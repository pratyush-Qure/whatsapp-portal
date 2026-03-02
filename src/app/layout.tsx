import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { PageTracker } from "@/components/analytics/page-tracker";
import { AppShell } from "@/components/layout/app-shell";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "WhatsApp Messaging Portal",
  description: "Trigger-driven WhatsApp messaging platform",
  icons: {
    icon: "/favicon.ico",
  },
};

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/templates", label: "Templates" },
  { href: "/settings", label: "Settings" },
  { href: "/logs", label: "Logs" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark");})();`,
          }}
        />
        <ProjectSwitcher>
          <AppShell baseNavItems={baseNavItems}>
            <PageTracker />
            {children}
          </AppShell>
        </ProjectSwitcher>
      </body>
    </html>
  );
}
