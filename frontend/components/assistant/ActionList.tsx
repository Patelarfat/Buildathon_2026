import React from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { AssistantActionItem } from "@/lib/api";

interface ActionListProps {
  actions: AssistantActionItem[];
  className?: string;
}

export default function ActionList({ actions, className = "" }: ActionListProps) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between pb-1">
        <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#D99A16]" />
          RECOMMENDED ACTIONS ({actions.length})
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {actions.map((act, idx) => {
          const priority = (act.priority || (idx === 0 ? "IMMEDIATE" : "STANDARD")).toUpperCase();
          const isImmediate = priority === "IMMEDIATE" || priority === "HIGH";

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                isImmediate
                  ? "bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70"
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

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">
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
                </div>

                {act.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {act.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
