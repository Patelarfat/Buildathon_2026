"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Brain,
  Building2,
  Users,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Camera,
  ClipboardCheck,
  AlertCircle,
  AlertTriangle,
  Package,
  FolderKanban,
  HardHat,
  Hammer,
  SlidersHorizontal,
  LucideIcon,
} from "lucide-react";

export type DemoRole =
  | "PROJECT_MANAGER"
  | "SAFETY_OFFICER"
  | "SITE_SUPERVISOR"
  | "CONTRACTOR"
  | "ADMINISTRATOR";

export interface NavTabItem {
  label: string;
  href: (projectId: number) => string;
  icon: LucideIcon;
}

export interface RoleDefinition {
  id: DemoRole;
  label: string;
  shortCode: string;
  badge: string;
  description: string;
  icon: LucideIcon;
  defaultLandingPath: (projectId: number) => string;
  navTabs: NavTabItem[];
}

export const ROLE_DEFINITIONS: Record<DemoRole, RoleDefinition> = {
  PROJECT_MANAGER: {
    id: "PROJECT_MANAGER",
    label: "Project Manager",
    shortCode: "PM",
    badge: "Executive Focus",
    description: "Executive overview, AI assistant, project intelligence, and cross-site progress.",
    icon: LayoutDashboard,
    defaultLandingPath: (projectId: number) => `/projects/${projectId}/dashboard`,
    navTabs: [
      { label: "Manager Dashboard", href: (pid) => `/projects/${pid}/dashboard`, icon: LayoutDashboard },
      { label: "AI Assistant", href: (pid) => `/projects/${pid}/assistant`, icon: Bot },
      { label: "Intelligence", href: (pid) => `/projects/${pid}/intelligence`, icon: Brain },
      { label: "Project Structure", href: (pid) => `/projects/${pid}`, icon: Building2 },
      { label: "Team", href: (pid) => `/projects/${pid}#team`, icon: Users },
      { label: "Daily Reports", href: (pid) => `/projects/${pid}/daily-reports`, icon: FileText },
      { label: "Safety Incidents", href: (pid) => `/projects/${pid}/incidents`, icon: ShieldAlert },
    ],
  },
  SAFETY_OFFICER: {
    id: "SAFETY_OFFICER",
    label: "Safety Officer",
    shortCode: "SO",
    badge: "Safety & PPE",
    description: "Real-time PPE compliance, safety incident management, inspections, and hazard analysis.",
    icon: ShieldCheck,
    defaultLandingPath: (pid: number) => `/projects/${pid}/intelligence`,
    navTabs: [
      { label: "Safety Dashboard", href: (pid) => `/projects/${pid}/intelligence`, icon: ShieldAlert },
      { label: "Site Photos", href: (pid) => `/projects/${pid}/photos`, icon: Camera },
      { label: "Safety Incidents", href: (pid) => `/projects/${pid}/incidents`, icon: AlertTriangle },
      { label: "Inspections", href: (pid) => `/projects/${pid}/inspections`, icon: ClipboardCheck },
      { label: "Observations", href: (pid) => `/projects/${pid}/observations`, icon: AlertCircle },
    ],
  },
  SITE_SUPERVISOR: {
    id: "SITE_SUPERVISOR",
    label: "Site Supervisor",
    shortCode: "SS",
    badge: "Field Operations",
    description: "Daily field logs, worker presence, site photos, observation issues, and material tracking.",
    icon: HardHat,
    defaultLandingPath: (pid: number) => `/projects/${pid}/photos`,
    navTabs: [
      { label: "Site Photos", href: (pid) => `/projects/${pid}/photos`, icon: Camera },
      { label: "Daily Reports", href: (pid) => `/projects/${pid}/daily-reports`, icon: FileText },
      { label: "Observations", href: (pid) => `/projects/${pid}/observations`, icon: AlertCircle },
      { label: "Materials", href: (pid) => `/projects/${pid}/materials`, icon: Package },
    ],
  },
  CONTRACTOR: {
    id: "CONTRACTOR",
    label: "Contractor",
    shortCode: "CO",
    badge: "Trades & Materials",
    description: "Subcontractor work progress, materials delivery, site photos, and operational blockers.",
    icon: Hammer,
    defaultLandingPath: (pid: number) => `/projects/${pid}/daily-reports`,
    navTabs: [
      { label: "Daily Reports", href: (pid) => `/projects/${pid}/daily-reports`, icon: FileText },
      { label: "Materials", href: (pid) => `/projects/${pid}/materials`, icon: Package },
      { label: "Site Photos", href: (pid) => `/projects/${pid}/photos`, icon: Camera },
      { label: "Issues / Delays", href: (pid) => `/projects/${pid}/observations`, icon: AlertCircle },
    ],
  },
  ADMINISTRATOR: {
    id: "ADMINISTRATOR",
    label: "Construction Administrator",
    shortCode: "AD",
    badge: "System Admin",
    description: "Multi-project structure, sites, zones/areas hierarchy, team permissions, and audits.",
    icon: SlidersHorizontal,
    defaultLandingPath: (pid: number) => `/projects/${pid}`,
    navTabs: [
      { label: "Projects", href: () => `/projects`, icon: FolderKanban },
      { label: "Reports", href: (pid) => `/projects/${pid}/daily-reports`, icon: FileText },
    ],
  },
};

interface RoleContextType {
  role: DemoRole;
  roleConfig: RoleDefinition;
  setRole: (role: DemoRole, autoNavigate?: boolean) => void;
  getLandingPathForProject: (projectId: number) => string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>("PROJECT_MANAGER");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cs_demo_role") as DemoRole | null;
      if (saved && ROLE_DEFINITIONS[saved]) {
        setRoleState(saved);
      }
    }
  }, []);

  const setRole = (newRole: DemoRole, autoNavigate = true) => {
    if (!ROLE_DEFINITIONS[newRole]) return;
    setRoleState(newRole);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cs_demo_role", newRole);
      } catch {
        // ignore
      }
    }

    if (autoNavigate && pathname) {
      const match = pathname.match(/^\/projects\/(\d+)/);
      if (match) {
        const projectId = Number(match[1]);
        if (!isNaN(projectId) && projectId > 0) {
          const targetPath = ROLE_DEFINITIONS[newRole].defaultLandingPath(projectId);
          if (pathname !== targetPath) {
            router.push(targetPath);
          }
        }
      }
    }
  };

  const getLandingPathForProject = (projectId: number) => {
    return ROLE_DEFINITIONS[role]?.defaultLandingPath(projectId) || `/projects/${projectId}/dashboard`;
  };

  const roleConfig = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.PROJECT_MANAGER;

  return (
    <RoleContext.Provider
      value={{
        role,
        roleConfig,
        setRole,
        getLandingPathForProject,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    return {
      role: "PROJECT_MANAGER" as DemoRole,
      roleConfig: ROLE_DEFINITIONS.PROJECT_MANAGER,
      setRole: () => {},
      getLandingPathForProject: (pid: number) => `/projects/${pid}/dashboard`,
    };
  }
  return context;
}
