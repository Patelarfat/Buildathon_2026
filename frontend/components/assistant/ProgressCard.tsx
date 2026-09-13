import React from "react";
import { Activity, Users, CloudSun, AlertCircle, CheckCircle2 } from "lucide-react";
import { AssistantProgressInfo } from "@/lib/api";

interface ProgressCardProps {
  progress: AssistantProgressInfo;
  className?: string;
}

export default function ProgressCard({ progress, className = "" }: ProgressCardProps) {
  if (!progress) return null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 block">
              SITE OPERATIONS & WORKFORCE
            </span>
            <h4 className="text-xs font-bold text-slate-900">
              Daily Progress Summary
            </h4>
          </div>
        </div>

        {progress.progress_pct !== null && progress.progress_pct !== undefined && (
          <span className="text-sm font-extrabold text-slate-900 font-mono bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
            {progress.progress_pct}% Overall Progress
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Workers on Site */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Workforce Active</span>
          </div>
          <div className="text-lg font-extrabold text-slate-900 font-mono">
            {progress.workers_count ?? "N/A"} <span className="text-xs font-normal text-slate-500">workers</span>
          </div>
        </div>

        {/* Weather Conditions */}
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-700 text-xs font-bold">
            <CloudSun className="w-3.5 h-3.5 text-amber-500" />
            <span>Weather Condition</span>
          </div>
          <div className="text-sm font-bold text-slate-900 pt-1">
            {progress.weather || "Clear / Favorable"}
          </div>
        </div>
      </div>

      {progress.work_completed && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-500">Work Completed:</span>
          <p className="text-xs text-slate-700 leading-relaxed bg-[#FAF9F6] p-2.5 rounded-lg border border-slate-200">
            {progress.work_completed}
          </p>
        </div>
      )}

      {progress.blockers && progress.blockers.toLowerCase() !== "none" && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Active Blocker: </strong>
            <span>{progress.blockers}</span>
          </div>
        </div>
      )}
    </div>
  );
}
