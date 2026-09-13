"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "../lib/RoleContext";

interface ProjectNavProps {
  projectId: number;
}

export default function ProjectNav({ projectId }: ProjectNavProps) {
  const pathname = usePathname();
  const { roleConfig } = useRole();

  const tabs = roleConfig.navTabs;
  const RoleIcon = roleConfig.icon;

  return (
    <div className="border-t border-[#E7E5E4] bg-white text-slate-900">
      {/* Role Perspective Context Strip */}
      <div className="bg-[#FAF9F6] border-b border-[#E7E5E4]/80 px-4 sm:px-8 py-1.5">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider shrink-0">
              Active Role:
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-[#F5B82E]/20 text-[#855B04] border border-[#F5B82E]/40 shrink-0">
              <RoleIcon className="w-3.5 h-3.5 text-[#D99A16]" />
              {roleConfig.label}
            </span>
            <span className="hidden md:inline text-[11px] text-[#78716C] font-normal truncate">
              • {roleConfig.description}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
            Demo Mode
          </span>
        </div>
      </div>

      {/* Role-Specific Navigation Tabs */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="max-w-[1280px] mx-auto flex items-center space-x-5 min-w-max px-4 sm:px-8">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const targetHref = tab.href(projectId);
            const purePath = targetHref.split("#")[0];

            let isActive = false;
            if (purePath === `/projects/${projectId}`) {
              isActive = pathname === `/projects/${projectId}`;
            } else if (purePath === "/projects") {
              isActive = pathname === "/projects";
            } else {
              isActive = pathname.startsWith(purePath);
            }

            return (
              <Link
                key={`${tab.label}-${idx}`}
                href={targetHref}
                className={`py-3.5 text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all relative ${
                  isActive
                    ? "text-slate-900 font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2.5px] after:bg-[#F5B82E] after:rounded-full"
                    : "text-slate-500 hover:text-slate-900 font-medium"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#D99A16]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
