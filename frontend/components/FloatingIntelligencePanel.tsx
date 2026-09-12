"use client";

import { ShieldCheck, Activity, ArrowRight, BarChart2, AlertTriangle } from "lucide-react";
import { Project } from "../lib/api";

interface FloatingIntelligencePanelProps {
  projects: Project[];
}

export default function FloatingIntelligencePanel({
  projects,
}: FloatingIntelligencePanelProps) {
  return (
    <div className="w-full max-w-[320px] bg-[#0B0F14]/70 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-4 text-slate-100 shadow-lg">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-[#F5B82E]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            SITE INTELLIGENCE
          </span>
        </div>
        <span className="text-[11px] font-normal text-slate-400">Live</span>
      </div>

      {/* 3 Metric Columns */}
      <div className="grid grid-cols-3 gap-2 text-left">
        {/* Safety Metric */}
        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 font-normal block">Safety</span>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-400 truncate">
              Stable
            </span>
          </div>
        </div>

        {/* Progress Metric (Muted text instead of blue) */}
        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 font-normal block">Progress</span>
          <div className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="text-xs font-semibold text-slate-200 truncate">
              On track
            </span>
          </div>
        </div>

        {/* Risk Level Metric */}
        <div className="space-y-0.5">
          <span className="text-[10px] text-slate-400 font-normal block">Risk Level</span>
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-emerald-400 truncate">
              Low
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice */}
      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
        <p className="truncate pr-2 font-normal text-[11px]">
          AI risk detection active.
        </p>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </div>
    </div>
  );
}


