import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Zap, CheckCircle2, User, ArrowRight } from "lucide-react";
import { AssistantActionItem } from "@/lib/api";

interface ActionListProps {
  actions: AssistantActionItem[];
  className?: string;
}

export default function ActionList({ actions, className = "" }: ActionListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const match = pathname ? pathname.match(/^\/projects\/(\d+)/) : null;
  const currentProjectId = match ? match[1] : null;

  if (!actions || actions.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#D99A16]" />
          RECOMMENDED ACTIONS ({actions.length})
        </span>
        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
          Click any action to inspect incident / details →
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {actions.map((act, idx) => {
          const priority = (act.priority || (idx === 0 ? "IMMEDIATE" : "STANDARD")).toUpperCase();
          const isImmediate = priority === "IMMEDIATE" || priority === "HIGH";

          // Dynamically resolve destination route
          let targetUrl = act.link;
          if (!targetUrl && currentProjectId) {
            if ((act.entity_type === "INCIDENT" || act.category?.toLowerCase() === "safety") && act.entity_id) {
              targetUrl = `/projects/${currentProjectId}/incidents?incidentId=${act.entity_id}#incident-${act.entity_id}`;
            } else if (act.entity_type === "INSPECTION" || act.category?.toLowerCase() === "quality") {
              targetUrl = `/projects/${currentProjectId}/inspections`;
            } else if (act.entity_type === "MATERIAL" || act.category?.toLowerCase() === "materials") {
              targetUrl = `/projects/${currentProjectId}/materials`;
            } else if (act.entity_type === "PPE") {
              targetUrl = `/projects/${currentProjectId}/photos`;
            }
          }

          const isClickable = Boolean(targetUrl);

          return (
            <div
              key={idx}
              onClick={() => {
                if (targetUrl) {
                  router.push(targetUrl);
                }
              }}
              title={isClickable ? `Click to view ${act.entity_type === "INCIDENT" ? `Safety Incident #${act.entity_id || ""}` : "details"}` : undefined}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                isClickable ? "cursor-pointer group hover:shadow-md hover:border-[#D99A16]" : ""
              } ${
                isImmediate
                  ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/80"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Step number badge */}
              <div
                className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                  isImmediate
                    ? "bg-[#D99A16] text-white"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {idx + 1}
              </div>

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-bold text-slate-900 ${isClickable ? "group-hover:text-[#926405] transition-colors" : ""}`}>
                    {act.title}
                  </span>

                  {act.priority && (
                    <span
                      className={`text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                        isImmediate
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {act.priority}
                    </span>
                  )}

                  {act.category && (
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                      {act.category}
                    </span>
                  )}

                  {act.role && (() => {
                    const roleMatch = act.role.match(/^([^(]+)\s*\(([^)]+)\)$/);
                    if (roleMatch) {
                      const roleTitle = roleMatch[1].trim();
                      const personName = roleMatch[2].trim();
                      return (
                        <span className="text-[11px] text-blue-900 bg-blue-50/90 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-xs">
                          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="text-slate-500 text-[10px] font-medium">{roleTitle}:</span>
                          <span className="text-xs sm:text-[13px] font-extrabold text-blue-950 tracking-tight">{personName}</span>
                        </span>
                      );
                    }
                    return (
                      <span className="text-xs font-extrabold text-blue-950 bg-blue-50/90 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-xs">
                        <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{act.role}</span>
                      </span>
                    );
                  })()}
                </div>

                {act.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {act.description}
                  </p>
                )}
              </div>

              {/* Action Click Navigation Affordance */}
              {isClickable && (
                <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-700 group-hover:text-amber-950 group-hover:translate-x-0.5 transition-all self-center pl-1">
                  <span className="hidden md:inline text-[10px] uppercase tracking-wide">
                    {act.entity_type === "INCIDENT" || act.category?.toLowerCase() === "safety" ? "View Incident" : "Open"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#D99A16]" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
