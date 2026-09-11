"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ProjectNavProps {
  projectId: number;
}

export default function ProjectNav({ projectId }: ProjectNavProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Overview & Structure", href: `/projects/${projectId}`, icon: "🏗️" },
    { label: "Intelligence Engine", href: `/projects/${projectId}/intelligence`, icon: "🧠" },
    { label: "Site Photos", href: `/projects/${projectId}/photos`, icon: "📸" },
    { label: "Daily Reports", href: `/projects/${projectId}/daily-reports`, icon: "📋" },
    { label: "Safety Incidents", href: `/projects/${projectId}/incidents`, icon: "⚠️" },
    { label: "Inspections", href: `/projects/${projectId}/inspections`, icon: "🔍" },
    { label: "Observations & Issues", href: `/projects/${projectId}/observations`, icon: "👁️" },
    { label: "Materials", href: `/projects/${projectId}/materials`, icon: "🧱" },
  ];

  return (
    <div className="border-b border-slate-800 bg-slate-900/60 rounded-xl p-1 mb-8 overflow-x-auto scrollbar-none">
      <div className="flex items-center space-x-1 min-w-max">
        {tabs.map((tab) => {
          const isActive =
            tab.href === `/projects/${projectId}`
              ? pathname === `/projects/${projectId}`
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
