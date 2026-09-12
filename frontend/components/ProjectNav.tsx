"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Building2,
  Brain,
  Camera,
  FileText,
  ShieldAlert,
  ClipboardCheck,
  AlertCircle,
  Package,
} from "lucide-react";

interface ProjectNavProps {
  projectId: number;
}

export default function ProjectNav({ projectId }: ProjectNavProps) {
  const pathname = usePathname();

  const tabs = [
    { label: "Manager Dashboard", href: `/projects/${projectId}/dashboard`, icon: LayoutDashboard },
    { label: "AI Assistant", href: `/projects/${projectId}/assistant`, icon: Bot },
    { label: "Overview & Structure", href: `/projects/${projectId}`, icon: Building2 },
    { label: "Intelligence", href: `/projects/${projectId}/intelligence`, icon: Brain },
    { label: "Site Photos", href: `/projects/${projectId}/photos`, icon: Camera },
    { label: "Daily Reports", href: `/projects/${projectId}/daily-reports`, icon: FileText },
    { label: "Safety", href: `/projects/${projectId}/incidents`, icon: ShieldAlert },
    { label: "Inspections", href: `/projects/${projectId}/inspections`, icon: ClipboardCheck },
    { label: "Observations", href: `/projects/${projectId}/observations`, icon: AlertCircle },
    { label: "Materials", href: `/projects/${projectId}/materials`, icon: Package },
  ];

  return (
    <div className="border-t border-[#E7E5E4] bg-white text-slate-900 overflow-x-auto scrollbar-none">
      <div className="max-w-[1280px] mx-auto flex items-center space-x-6 min-w-max px-4 sm:px-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === `/projects/${projectId}`
              ? pathname === `/projects/${projectId}`
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
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
  );
}

