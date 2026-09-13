import React from "react";
import { AlertCircle, AlertTriangle, ShieldAlert, FileText, MapPin, Building } from "lucide-react";
import { AssistantAttentionItem } from "@/lib/api";

interface AttentionCardProps {
  item: AssistantAttentionItem;
  className?: string;
}

export default function AttentionCard({ item, className = "" }: AttentionCardProps) {
  const severityUpper = (item.severity || "MEDIUM").toUpperCase();

  const getSeverityStyle = () => {
    switch (severityUpper) {
      case "CRITICAL":
        return {
          border: "border-rose-300",
          bg: "bg-rose-50/70",
          badge: "bg-rose-100 text-rose-800 border-rose-300",
          icon: ShieldAlert,
          iconColor: "text-rose-600",
        };
      case "HIGH":
        return {
          border: "border-amber-300",
          bg: "bg-amber-50/50",
          badge: "bg-amber-100 text-amber-800 border-amber-300",
          icon: AlertTriangle,
          iconColor: "text-amber-600",
        };
      case "MEDIUM":
        return {
          border: "border-amber-200",
          bg: "bg-amber-50/30",
          badge: "bg-amber-100/70 text-amber-800 border-amber-200",
          icon: AlertCircle,
          iconColor: "text-amber-500",
        };
      default:
        return {
          border: "border-slate-200",
          bg: "bg-white",
          badge: "bg-slate-100 text-slate-700 border-slate-200",
          icon: FileText,
          iconColor: "text-slate-500",
        };
    }
  };

  const style = getSeverityStyle();
  const Icon = style.icon;

  return (
    <div className={`rounded-xl border p-3.5 transition-all hover:shadow-2xs ${style.border} ${style.bg} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <div className={`p-1 rounded-lg bg-white border ${style.border} ${style.iconColor} shrink-0 mt-0.5`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${style.badge}`}>
                {severityUpper}
              </span>

              {item.category && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 bg-black/5 font-semibold">
                  {item.category}
                </span>
              )}

              {item.status && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-slate-700 border border-slate-200">
                  {item.status.toUpperCase()}
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-slate-900 leading-snug">
              {item.title}
            </h4>
          </div>
        </div>

        {item.id && (
          <span className="text-[10px] font-mono text-slate-400 shrink-0">
            {item.id.startsWith("#") ? item.id : `#${item.id}`}
          </span>
        )}
      </div>

      {item.description && (
        <p className="mt-2 text-xs text-slate-700 leading-relaxed pl-7">
          {item.description}
        </p>
      )}

      {/* Spatial Location Badges */}
      {(item.site_name || item.area_name) && (
        <div className="mt-2.5 pt-2 border-t border-black/5 pl-7 flex flex-wrap items-center gap-1.5 text-[11px]">
          {item.site_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 font-medium">
              <Building className="w-3 h-3 text-slate-400" />
              <span>Site: <strong className="text-slate-900">{item.site_name}</strong></span>
            </span>
          )}
          {item.area_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-medium">
              <MapPin className="w-3 h-3 text-amber-500" />
              <span>Area: <strong className="text-amber-950">{item.area_name}</strong></span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
