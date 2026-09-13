import React from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp, Info } from "lucide-react";
import { AssistantRiskInfo } from "@/lib/api";

export interface RiskInfo {
  score?: number | null;
  level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  summary?: string | null;
  factors?: string[];
}

interface RiskCardProps {
  risk: AssistantRiskInfo | RiskInfo;
  className?: string;
}

export default function RiskCard({ risk, className = "" }: RiskCardProps) {
  const score = risk.score ?? 0;
  const levelUpper = (risk.level || (score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW")).toUpperCase();

  const getTheme = () => {
    switch (levelUpper) {
      case "CRITICAL":
        return {
          bg: "bg-rose-50/80",
          border: "border-rose-300",
          text: "text-rose-900",
          badgeBg: "bg-rose-100",
          badgeText: "text-rose-800",
          badgeBorder: "border-rose-300",
          barColor: "bg-rose-600",
          icon: AlertOctagon,
          iconColor: "text-rose-600",
        };
      case "HIGH":
        return {
          bg: "bg-amber-50/80",
          border: "border-amber-300",
          text: "text-amber-900",
          badgeBg: "bg-amber-100",
          badgeText: "text-amber-800",
          badgeBorder: "border-amber-300",
          barColor: "bg-amber-500",
          icon: AlertTriangle,
          iconColor: "text-amber-600",
        };
      case "MEDIUM":
        return {
          bg: "bg-amber-50/50",
          border: "border-amber-200",
          text: "text-amber-900",
          badgeBg: "bg-amber-100/80",
          badgeText: "text-amber-800",
          badgeBorder: "border-amber-200",
          barColor: "bg-amber-400",
          icon: AlertTriangle,
          iconColor: "text-amber-500",
        };
      default:
        return {
          bg: "bg-emerald-50/70",
          border: "border-emerald-200",
          text: "text-emerald-900",
          badgeBg: "bg-emerald-100",
          badgeText: "text-emerald-800",
          badgeBorder: "border-emerald-300",
          barColor: "bg-emerald-500",
          icon: ShieldCheck,
          iconColor: "text-emerald-600",
        };
    }
  };

  const theme = getTheme();
  const Icon = theme.icon;

  return (
    <div className={`rounded-xl border p-4 shadow-2xs transition-all ${theme.bg} ${theme.border} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg bg-white/80 border ${theme.border} ${theme.iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 block">
              AUTHORITATIVE RISK EVALUATION
            </span>
            <div className="text-xs font-bold text-slate-800">
              Project Risk Status
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${theme.barColor}`} />
            {levelUpper} RISK
          </span>
          <div className="text-sm font-extrabold text-slate-900 font-mono bg-white/90 px-2 py-0.5 rounded-md border border-black/5">
            {score} <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 space-y-1.5">
        <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${theme.barColor}`}
            style={{ width: `${Math.min(Math.max(score, 5), 100)}%` }}
          />
        </div>
      </div>

      {/* Summary Narrative */}
      {risk.summary && (
        <p className="mt-2.5 text-xs text-slate-700 leading-relaxed">
          {risk.summary}
        </p>
      )}

      {/* Contributing Factors */}
      {risk.factors && risk.factors.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-black/5 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            KEY CONTRIBUTING FACTORS:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {risk.factors.map((factor, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white/80 border border-black/10 text-slate-700 font-medium"
              >
                <TrendingUp className="w-3 h-3 text-slate-400" />
                {factor}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
