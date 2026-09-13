import React from "react";
import { ShieldCheck, ShieldAlert, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { AssistantPPEInfo } from "@/lib/api";

interface PPECardProps {
  ppe: AssistantPPEInfo;
  className?: string;
}

export default function PPECard({ ppe, className = "" }: PPECardProps) {
  if (!ppe) return null;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-[#D99A16] border border-amber-200">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 block">
              AI COMPUTER VISION DETECTION
            </span>
            <h4 className="text-xs font-bold text-slate-900">
              PPE Compliance Breakdown
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-slate-900 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            {ppe.compliance_pct}% Compliance
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Compliance Count */}
        <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Verified Compliant</span>
          </div>
          <div className="text-lg font-extrabold text-emerald-950 font-mono">
            {ppe.compliance_count}
          </div>
          <span className="text-[10px] text-emerald-700 block">
            Helmets, vests, gloves & boots detected
          </span>
        </div>

        {/* Violations Count */}
        <div className="p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 space-y-1">
          <div className="flex items-center gap-1.5 text-rose-800 text-xs font-bold">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Active Violations</span>
          </div>
          <div className="text-lg font-extrabold text-rose-950 font-mono">
            {ppe.violations_count}
          </div>
          <span className="text-[10px] text-rose-700 block">
            Missing required PPE in active camera zones
          </span>
        </div>
      </div>

      {ppe.violations_list && ppe.violations_list.length > 0 && ppe.violations_count > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-500">Violations Summary:</span>
          {ppe.violations_list.map((v, idx) => (
            <div key={idx} className="text-xs text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
