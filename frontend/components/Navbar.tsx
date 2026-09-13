"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getHealth } from "../lib/api";
import { Plus, UserCheck } from "lucide-react";
import { useRole, DemoRole } from "../lib/RoleContext";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const { role, roleConfig, setRole } = useRole();

  const isHomePage = pathname === "/";

  // Derive current active project ID from URL if inside a project route
  const projectMatch = pathname ? pathname.match(/^\/projects\/(\d+)/) : null;
  const currentProjectId = projectMatch ? projectMatch[1] : null;

  // Persist current project ID in localStorage for top navbar context persistence
  useEffect(() => {
    if (currentProjectId && typeof window !== "undefined") {
      try {
        localStorage.setItem("cs_last_project_id", currentProjectId);
      } catch {
        // ignore
      }
    }
  }, [currentProjectId]);

  useEffect(() => {
    getHealth()
      .then((data) => setHealthy(data.status === "healthy"))
      .catch(() => setHealthy(false));
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { name: string; href: string }) => {
    if (link.name === "AI Assistant") {
      e.preventDefault();
      let targetPid = currentProjectId;
      if (!targetPid && typeof window !== "undefined") {
        try {
          targetPid = localStorage.getItem("cs_last_project_id");
        } catch {
          // ignore
        }
      }
      if (targetPid) {
        router.push(`/projects/${targetPid}/assistant`);
      } else {
        router.push("/projects");
      }
      return;
    }

    if (link.href.startsWith("#")) {
      e.preventDefault();
      if (!isHomePage) {
        router.push("/" + link.href);
      } else {
        const el = document.querySelector(link.href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  };

  const isAssistantActive = pathname ? pathname.includes("/assistant") : false;
  const isProjectsActive = pathname ? (pathname === "/projects" || (pathname.startsWith("/projects") && !isAssistantActive)) : false;

  const navLinks = [
    { name: "Projects", href: "/projects", isActive: isProjectsActive },
    { name: "Insights", href: "#insights", isActive: false },
    {
      name: "AI Assistant",
      href: currentProjectId ? `/projects/${currentProjectId}/assistant` : "/projects",
      isActive: isAssistantActive,
    },
  ];

  return (
    <header
      className={`${
        isHomePage
          ? "absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-[#0B0F14]/80 via-[#0B0F14]/30 to-transparent"
          : "sticky top-0 z-50 bg-[#0B0F14] border-b border-slate-800/80 shadow-sm"
      } w-full`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
        <div className="flex items-center space-x-8 lg:space-x-10">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-7 h-7 rounded bg-[#F5B82E] flex items-center justify-center text-[#0B0F14] font-extrabold text-[11px] tracking-wider group-hover:bg-[#D99A16] transition-colors">
              CS
            </div>
            <span className="font-semibold text-sm sm:text-base text-white tracking-tight">
              Construction Intelligence
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => {
              const isActive = link.isActive;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  className={`text-xs sm:text-sm transition-all py-1 relative ${
                    isActive
                      ? "text-white font-semibold after:absolute after:-bottom-1 after:left-0 after:right-0 after:h-[2px] after:bg-[#F5B82E] after:rounded-full"
                      : "text-slate-300 hover:text-white font-normal"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Demo Role Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/90 rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#F5B82E] uppercase tracking-wider">
              <UserCheck className="w-3.5 h-3.5 text-[#F5B82E] shrink-0" />
              <span className="hidden xl:inline">Demo Role:</span>
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as DemoRole)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer pr-1"
              aria-label="Select Demo Role"
            >
              <option value="PROJECT_MANAGER" className="bg-[#0B0F14] text-white">Project Manager</option>
              <option value="SAFETY_OFFICER" className="bg-[#0B0F14] text-white">Safety Officer</option>
              <option value="SITE_SUPERVISOR" className="bg-[#0B0F14] text-white">Site Supervisor</option>
              <option value="CONTRACTOR" className="bg-[#0B0F14] text-white">Contractor</option>
              <option value="ADMINISTRATOR" className="bg-[#0B0F14] text-white">Construction Administrator</option>
            </select>
          </div>

          {/* Health Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                healthy === true
                  ? "bg-emerald-400"
                  : healthy === false
                  ? "bg-rose-500"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="text-[11px] text-slate-300 font-normal">
              {healthy === true
                ? "System Online"
                : healthy === false
                ? "System Offline"
                : "Checking Status..."}
            </span>
          </div>

          {/* Primary Action Button (Yellow Accent) */}
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#F5B82E] hover:bg-[#D99A16] text-[#0B0F14] text-xs font-semibold transition-colors active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-[#0B0F14]" />
            <span className="hidden sm:inline">New Project</span>
          </Link>

          {/* User Initial Badge with Active Role Shortcode */}
          <div
            className="w-7 h-7 rounded bg-slate-800/80 border border-white/10 flex items-center justify-center text-[11px] font-bold text-[#F5B82E]"
            title={`Active Demo Role: ${roleConfig.label} (${roleConfig.badge})`}
          >
            {roleConfig.shortCode}
          </div>
        </div>
      </div>
    </header>
  );
}





