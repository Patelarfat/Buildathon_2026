"use client";

import React from "react";
import {
  Calendar,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Boxes,
  ShieldCheck,
  HardHat,
  FileText
} from "lucide-react";
import { AssistantProgressInfo } from "@/lib/api";

interface WeeklyProgressCardProps {
  progress: AssistantProgressInfo;
  className?: string;
}

export default function WeeklyProgressCard({
  progress,
  className = ""
}: WeeklyProgressCardProps) {
  if (!progress) return null;

  const pct = progress.progress_pct ?? 0;
  const daysLogged = progress.days_logged ?? 0;
  const workers = progress.workers_count ?? 0;

  return (
    <div className={`rounded-xl border border-blue-200/80 bg-white p-4.5 shadow-2xs space-y-4 ${className}`}>
      {/* 1. Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-blue-600 block">
              WEEKLY SITE REPORT
            </span>
            <h4 className="text-sm font-bold text-slate-900">
              Weekly Construction Progress Report
            </h4>
          </div>
        </div>

        {progress.reporting_period && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono font-medium text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Period: {progress.reporting_period}</span>
          </div>
        )}
      </div>

      {/* 2. Top KPI Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Milestone Progress */}
        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50/70 to-slate-50 border border-blue-100 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-700 text-[11px] font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Milestone Progress</span>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {pct}%
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>

        {/* Workforce */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-bold">
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Active Workforce</span>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {workers > 0 ? workers : "Active"}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            workers deployed
          </span>
        </div>

        {/* Daily Logs Reviewed */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-bold">
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Daily Reports</span>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {daysLogged > 0 ? daysLogged : "1+"}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            logs consolidated
          </span>
        </div>

        {/* Site Operational Status */}
        <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold">
            <HardHat className="w-3.5 h-3.5" />
            <span>Site Activity</span>
          </div>
          <div className="text-sm font-extrabold text-emerald-800 pt-0.5">
            Active Progress
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">
            Schedule on track
          </span>
        </div>
      </div>

      {/* 3. Work Completed / Key Activities */}
      {progress.activities && progress.activities.length > 0 ? (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            WORK COMPLETED THIS WEEK ({progress.activities.length} ENTRIES)
          </span>
          <div className="space-y-1.5">
            {progress.activities.map((act, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-[#FAF9F6] border border-slate-200 text-xs text-slate-700 leading-relaxed flex items-start gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>
      ) : progress.work_completed ? (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            WORK COMPLETED THIS WEEK
          </span>
          <p className="text-xs text-slate-700 leading-relaxed bg-[#FAF9F6] p-3 rounded-lg border border-slate-200 whitespace-pre-line">
            {progress.work_completed}
          </p>
        </div>
      ) : null}

      {/* 4. Next Work Planned */}
      {progress.work_planned && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-blue-600" />
            PLANNED WORK & UPCOMING PACKAGES
          </span>
          <p className="text-xs text-slate-700 leading-relaxed bg-blue-50/50 p-2.5 rounded-lg border border-blue-200/80">
            {progress.work_planned}
          </p>
        </div>
      )}

      {/* 5. Issues, Blockers & Delays */}
      {progress.blockers && progress.blockers.toLowerCase() !== "none" && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="font-bold text-rose-900 block">Issues & Site Delays:</strong>
            <span>{progress.blockers}</span>
          </div>
        </div>
      )}

      {/* 6. Materials & Supply Chain Snapshot (if available) */}
      {progress.materials_summary && (
        <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <Boxes className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Materials Tracked: </strong>
            <span>{progress.materials_summary}</span>
          </div>
        </div>
      )}

      {/* 7. Safety Status Snapshot */}
      {progress.safety_summary && (
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold text-slate-900">Safety & Quality Status: </strong>
            <span>{progress.safety_summary}</span>
          </div>
        </div>
      )}
    </div>
  );
}
