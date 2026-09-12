"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getHealth } from "../lib/api";
import { Plus } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [healthy, setHealthy] = useState<boolean | null>(null);

  const isHomePage = pathname === "/";

  useEffect(() => {
    getHealth()
      .then((data) => setHealthy(data.status === "healthy"))
      .catch(() => setHealthy(false));
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      if (!isHomePage) {
        router.push("/" + href);
      } else {
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  };

  const navLinks = [
    { name: "Projects", href: "/projects" },
    { name: "Insights", href: "#insights" },
    { name: "AI Assistant", href: "#ai-assistant" },
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
              const isActive =
                link.href === "/projects" && pathname.startsWith("/projects");
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
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
        <div className="flex items-center space-x-5">
          {/* Health Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300">
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
            <span>New Project</span>
          </Link>

          {/* User Initial Badge */}
          <div className="w-7 h-7 rounded bg-slate-800/80 border border-white/10 flex items-center justify-center text-[11px] font-medium text-slate-300">
            OM
          </div>
        </div>
      </div>
    </header>
  );
}





