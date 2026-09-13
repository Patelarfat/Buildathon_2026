"use client";

import React, { useState } from "react";
import { Database, ChevronDown, ChevronUp, FileText, ShieldAlert, CheckSquare, Layers, Eye, ShieldCheck, MapPin } from "lucide-react";
import { AssistantSource } from "@/lib/api";

interface EvidenceSourcesProps {
  sources: AssistantSource[];
  className?: string;
}

export default function EvidenceSources({ sources, className = "" }: EvidenceSourcesProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  const formatSourceLabel = (type: string, id?: string) => {
    const t = (type || "").toUpperCase();
    const sid = (id || "").toLowerCase();

    if (t.includes("PPE") || sid.includes("ppe") || sid.includes("vision")) {
      return { label: "AI Computer Vision", icon: Eye, badgeColor: "bg-purple-50 text-purple-700 border-purple-200" };
    }
    if (t.includes("RISK") || sid.includes("risk")) {
      return { label: "Risk Assessment", icon: ShieldCheck, badgeColor: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    if (t.includes("INCIDENT") || sid.includes("incident")) {
      return { label: "Safety Incident", icon: ShieldAlert, badgeColor: "bg-rose-50 text-rose-700 border-rose-200" };
    }
    if (t.includes("INSPECTION") || sid.includes("inspection")) {
      return { label: "Inspection Report", icon: CheckSquare, badgeColor: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (t.includes("OBSERVATION") || sid.includes("observation")) {
      return { label: "Site Observation", icon: FileText, badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    }
    if (t.includes("MATERIAL") || sid.includes("material")) {
      return { label: "Material Inventory", icon: Layers, badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (t.includes("DAILY") || t.includes("REPORT") || sid.includes("report")) {
      return { label: "Daily Site Log", icon: FileText, badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    }
    if (t.includes("AREA") || sid.includes("area")) {
      return { label: "Area Intelligence", icon: MapPin, badgeColor: "bg-slate-50 text-slate-700 border-slate-200" };
    }
    return { label: type.replace(/_/g, " "), icon: FileText, badgeColor: "bg-slate-50 text-slate-700 border-slate-200" };
  };

  const cleanNumericId = (rawId?: string): string | null => {
    if (!rawId) return null;
    const digitsOnly = rawId.replace(/^[^\d]*/, "");
    if (digitsOnly && /^\d+$/.test(digitsOnly)) {
      return digitsOnly;
    }
    return null;
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3.5 py-2 bg-[#FAF9F6] hover:bg-slate-100 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-[#D99A16]" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Referenced Evidence & Sources ({sources.length})
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="text-[10px] font-mono">{expanded ? "Hide Details" : "Show Details"}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Collapsed view: Clean Chip row */}
      {!expanded && (
        <div className="p-2.5 flex flex-wrap gap-1.5">
          {sources.map((src, idx) => {
            const { label, icon: Icon, badgeColor } = formatSourceLabel(src.type, src.id);
            const numId = cleanNumericId(src.id);

            return (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border font-medium shadow-2xs ${badgeColor}`}
                title={src.title || src.detail}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
                {numId && <span className="font-mono text-slate-500 font-normal">#{numId}</span>}
              </span>
            );
          })}
        </div>
      )}

      {/* Expanded view: Detailed list */}
      {expanded && (
        <div className="p-3 divide-y divide-slate-100 space-y-2">
          {sources.map((src, idx) => {
            const { label, icon: Icon, badgeColor } = formatSourceLabel(src.type, src.id);
            const numId = cleanNumericId(src.id);

            return (
              <div key={idx} className="pt-2 first:pt-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-semibold ${badgeColor}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                    {numId && <span className="font-mono text-slate-500">#{numId}</span>}
                  </span>
                </div>
                {src.title && (
                  <p className="text-xs text-slate-800 font-medium pl-1">
                    {src.title}
                  </p>
                )}
                {src.detail && (
                  <p className="text-[11px] text-slate-500 pl-1 leading-relaxed">
                    {src.detail}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

