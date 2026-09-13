import React from "react";
import { MapPin, Building, ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react";
import { AssistantLocationItem } from "@/lib/api";

interface LocationCardProps {
  locations: AssistantLocationItem[];
  className?: string;
}

export default function LocationCard({ locations, className = "" }: LocationCardProps) {
  if (!locations || locations.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#D99A16]" />
          LOCATION & SPATIAL CONTEXT ({locations.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {locations.map((loc, idx) => {
          const riskScore = loc.risk_score;
          const riskLevel = (loc.risk_level || (riskScore && riskScore >= 50 ? "HIGH" : "MEDIUM")).toUpperCase();
          const isHigh = riskLevel === "HIGH" || riskLevel === "CRITICAL";

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border transition-all ${
                isHigh
                  ? "bg-rose-50/40 border-rose-200/80 hover:bg-rose-50/70"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`p-1.5 rounded-lg shrink-0 ${isHigh ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {loc.area_name || "Zone Area"}
                    </h4>
                    {loc.site_name && (
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{loc.site_name}</span>
                      </p>
                    )}
                  </div>
                </div>

                {riskScore !== null && riskScore !== undefined && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                      isHigh
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}
                  >
                    Risk: {riskScore}
                  </span>
                )}
              </div>

              {loc.issue_summary && (
                <p className="mt-2 text-xs text-slate-600 leading-snug">
                  {loc.issue_summary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
