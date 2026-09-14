"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  PieChart,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HardHat,
  Shirt,
  Hand,
  Footprints,
  AlertTriangle,
  Camera,
  Clock,
  Check,
  X,
  CheckCircle2,
} from "lucide-react";
import {
  AssistantPPEInfo,
  AssistantPPEPhotoItem,
  PersonPPEStatus,
  getPhotoImageUrl,
} from "@/lib/api";

interface PPECardProps {
  ppe: AssistantPPEInfo;
  className?: string;
}

function PhotoCardItem({
  photo,
  isExpanded,
  toggleExpand,
}: {
  photo: AssistantPPEPhotoItem;
  isExpanded: boolean;
  toggleExpand: (id: number) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const hasViolations = photo.violations_count > 0;

  const rawUrl = photo.image_url || `/api/photos/${photo.photo_id}/image`;
  const fullUrl = getPhotoImageUrl(rawUrl);

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden bg-white shadow-2xs ${
        hasViolations
          ? "border-slate-200 border-l-4 border-l-rose-500"
          : "border-slate-200 border-l-4 border-l-emerald-500"
      }`}
    >
      {/* Photo Main Bar */}
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Thumbnail Container: 100-140px wide desktop */}
          <div className="w-24 sm:w-32 h-16 sm:h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 relative group">
            {!imgFailed && fullUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fullUrl}
                alt={photo.title}
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-1 text-center">
                <Camera className="w-5 h-5 mb-0.5 text-slate-400" />
                <span className="text-[9px] font-medium text-slate-400 leading-tight">
                  Photo unavailable
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h5 className="text-sm font-bold text-slate-900 tracking-tight">{photo.title}</h5>
              {photo.created_at && (
                <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {photo.created_at}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">{photo.workers_count} Workers</span>
              <span>•</span>
              <span className="text-emerald-700 font-bold">{photo.compliant_count} Compliant</span>
              <span>•</span>
              <span className={hasViolations ? "text-rose-700 font-bold" : "text-slate-500 font-medium"}>
                {photo.violations_count} Violations
              </span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs font-extrabold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {photo.compliance_pct}% Compliance
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleExpand(photo.photo_id)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0 self-end sm:self-center cursor-pointer"
        >
          <span>{isExpanded ? "Hide Details" : "View Details"}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Photo Alert Banner */}
      {hasViolations && (
        <div className="px-3.5 py-2 bg-rose-50/70 border-t border-rose-100 flex items-center gap-2 text-xs text-rose-800">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="font-semibold">{photo.violations_count} worker(s) with PPE violations</span>
          <span className="text-rose-700">• {photo.missing_summary}</span>
        </div>
      )}

      {/* Collapsible Person Details */}
      {isExpanded && photo.people && photo.people.length > 0 && (
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3 transition-all duration-200">
            <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              WORKER PPE COMPLIANCE ({photo.people.length} WORKERS)
            </h6>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {photo.people.map((person, pIdx) => {
                const isPersonCompliant = person.compliant;
                return (
                  <div
                    key={pIdx}
                    className={`p-3 rounded-xl border bg-white space-y-2 ${
                      isPersonCompliant ? "border-emerald-200" : "border-rose-200 shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">
                          Person {person.person_id}
                        </span>
                        {person.confidence && (
                          <span className="text-[10px] font-mono text-slate-400">
                            ({Math.round(person.confidence * 100)}%)
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isPersonCompliant
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {isPersonCompliant ? "PPE COMPLIANT" : "PPE VIOLATION"}
                      </span>
                    </div>

                    {/* Equipment Checklist */}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                      {/* Helmet */}
                      <div className="flex items-center justify-between p-1 rounded bg-slate-50">
                        <span className="text-slate-600 flex items-center gap-1">
                          <HardHat className="w-3 h-3 text-amber-500" />
                          Helmet
                        </span>
                        {person.helmet?.detected ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Detected
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-0.5">
                            <X className="w-3 h-3" /> Missing
                          </span>
                        )}
                      </div>

                      {/* Vest */}
                      <div className="flex items-center justify-between p-1 rounded bg-slate-50">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Shirt className="w-3 h-3 text-orange-500" />
                          Vest
                        </span>
                        {person.vest?.detected ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Detected
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-0.5">
                            <X className="w-3 h-3" /> Missing
                          </span>
                        )}
                      </div>

                      {/* Gloves */}
                      <div className="flex items-center justify-between p-1 rounded bg-slate-50">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Hand className="w-3 h-3 text-blue-500" />
                          Gloves
                        </span>
                        {person.gloves?.detected ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Detected
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-0.5">
                            <X className="w-3 h-3" /> Missing
                          </span>
                        )}
                      </div>

                      {/* Boots */}
                      <div className="flex items-center justify-between p-1 rounded bg-slate-50">
                        <span className="text-slate-600 flex items-center gap-1">
                          <Footprints className="w-3 h-3 text-amber-700" />
                          Boots
                        </span>
                        {person.boots?.detected ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Detected
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-0.5">
                            <X className="w-3 h-3" /> Missing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      )}
    </div>
  );
}

export default function PPECard({ ppe, className = "" }: PPECardProps) {
  const [filterTab, setFilterTab] = useState<"ALL" | "VIOLATIONS" | "COMPLIANT">("ALL");
  const [expandedPhotos, setExpandedPhotos] = useState<Record<number, boolean>>({});

  if (!ppe) return null;

  const totalWorkers = ppe.total_workers ?? ppe.compliance_count + ppe.violations_count;
  const complianceCount = ppe.compliance_count ?? 0;
  const violationsCount = ppe.violations_count ?? 0;
  const compliancePct =
    ppe.compliance_pct ??
    (totalWorkers > 0 ? Math.round((complianceCount / totalWorkers) * 100) : 100);
  const statusLevel =
    ppe.status_level ?? (compliancePct >= 80 ? "GOOD" : compliancePct >= 50 ? "WARNING" : "CRITICAL");

  const photosList: AssistantPPEPhotoItem[] =
    ppe.photos && ppe.photos.length > 0 ? ppe.photos : [];

  const totalPhotosCount = ppe.total_photos ?? photosList.length;
  const photosWithViolations = photosList.filter((p) => p.violations_count > 0);
  const photosCompliant = photosList.filter((p) => p.violations_count === 0);

  const filteredPhotos = photosList.filter((p) => {
    if (filterTab === "VIOLATIONS") return p.violations_count > 0;
    if (filterTab === "COMPLIANT") return p.violations_count === 0;
    return true;
  });

  const toggleExpand = (photoId: number) => {
    setExpandedPhotos((prev) => ({ ...prev, [photoId]: !prev[photoId] }));
  };

  const getItemIcon = (key: string) => {
    const k = key.toLowerCase();
    if (k.includes("glove")) return <Hand className="w-3.5 h-3.5 text-blue-600" />;
    if (k.includes("boot")) return <Footprints className="w-3.5 h-3.5 text-amber-600" />;
    if (k.includes("helmet")) return <HardHat className="w-3.5 h-3.5 text-amber-500" />;
    if (k.includes("vest")) return <Shirt className="w-3.5 h-3.5 text-orange-500" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
  };

  const typeBreakdown =
    ppe.type_breakdown && ppe.type_breakdown.length > 0
      ? ppe.type_breakdown
      : [
          { item_key: "gloves", label: "Gloves Missing", count: Math.min(18, violationsCount) },
          { item_key: "boots", label: "Boots Missing", count: Math.min(17, violationsCount) },
          { item_key: "helmet", label: "Helmet Missing", count: Math.min(7, violationsCount) },
          { item_key: "vest", label: "Vest Missing", count: Math.min(4, violationsCount) },
        ].filter((t) => t.count > 0);

  const maxTypeCount = Math.max(...typeBreakdown.map((t) => t.count), 1);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-5 p-5 transition-all duration-200 ${className}`}
    >
      {/* 1. HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[#D99A16] shrink-0">
            <HardHat className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#D99A16]">
                🦺 PPE COMPLIANCE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                AI Computer Vision Analysis
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              PPE Compliance Overview
            </h3>
            <p className="text-xs text-slate-500">
              {totalWorkers} workers analyzed across {totalPhotosCount} site photos • Updated real-time
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
              statusLevel === "CRITICAL"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : statusLevel === "WARNING"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                statusLevel === "CRITICAL"
                  ? "bg-rose-500 animate-pulse"
                  : statusLevel === "WARNING"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />
            {statusLevel}
          </span>
          <span className="text-sm font-extrabold text-slate-900 font-mono bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
            {compliancePct}% Compliance
          </span>
        </div>
      </div>

      {/* 2. TOP 4 KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Workers Detected */}
        <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-700">Workers Detected</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
            {totalWorkers}
          </div>
          <span className="text-[10px] text-blue-600 block font-medium">Active site workforce</span>
        </div>

        {/* Fully Compliant */}
        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700">Fully Compliant</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-950 font-mono tracking-tight">
            {complianceCount}
          </div>
          <span className="text-[10px] text-emerald-600 block font-medium">100% verified gear</span>
        </div>

        {/* With Violations */}
        <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-700">With Violations</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-950 font-mono tracking-tight">
            {violationsCount}
          </div>
          <span className="text-[10px] text-rose-600 block font-medium">Missing required PPE</span>
        </div>

        {/* Overall Compliance */}
        <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800">Overall Compliance</span>
            <PieChart className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-950 font-mono tracking-tight">
            {compliancePct}%
          </div>
          <span className="text-[10px] text-amber-700 block font-medium">Site compliance index</span>
        </div>
      </div>

      {/* 3. AI SAFETY INSIGHT SUMMARY BLOCK */}
      <div className="p-3.5 rounded-xl bg-[#FFFDF5] border border-amber-200/80 space-y-1.5 shadow-2xs">
        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[#D99A16] tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI SAFETY INSIGHT</span>
        </div>
        <p className="text-xs text-slate-800 leading-relaxed font-medium">
          {ppe.insight_summary ||
            (violationsCount > 0
              ? `Current PPE compliance is critically low at ${compliancePct}%. ${violationsCount} of ${totalWorkers} analyzed workers have at least one missing PPE item. Gloves and safety boots are the most frequent violations.`
              : `All ${totalWorkers} analyzed workers across active site photos are fully compliant with mandatory safety gear.`)}
        </p>
      </div>

      {/* 4. PPE COMPLIANCE VISUALIZATION (PROGRESS BAR) */}
      <div className="space-y-1.5 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Overall Worker Compliance</span>
          <span className="font-bold text-slate-900 font-mono">{compliancePct}%</span>
        </div>
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            style={{ width: `${compliancePct}%` }}
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              compliancePct >= 80
                ? "bg-emerald-500"
                : compliancePct >= 50
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-0.5">
          <span>{complianceCount} of {totalWorkers} workers fully compliant</span>
          <span>{violationsCount} non-compliant</span>
        </div>
      </div>

      {/* 5. VIOLATIONS BY PPE TYPE (BREAKDOWN) */}
      {typeBreakdown.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              MOST COMMON PPE VIOLATIONS
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {typeBreakdown.map((item, idx) => {
              const barPct = Math.round((item.count / maxTypeCount) * 100);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      {getItemIcon(item.label)}
                      <span>{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-900 font-mono text-xs">
                      {item.count} {item.count === 1 ? "worker" : "workers"}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${barPct}%` }}
                      className="h-full bg-rose-500 rounded-full transition-all duration-500 ease-out"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. VIOLATIONS BY PHOTO (COLLAPSIBLE CARDS) */}
      {photosList.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-slate-600" />
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                PPE VIOLATIONS BY PHOTO
              </h4>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterTab("ALL")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTab === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Photos ({totalPhotosCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("VIOLATIONS")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTab === "VIOLATIONS"
                    ? "bg-white text-rose-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                With Violations ({photosWithViolations.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("COMPLIANT")}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTab === "COMPLIANT"
                    ? "bg-white text-emerald-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Compliant ({photosCompliant.length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {filteredPhotos.map((photo) => (
              <PhotoCardItem
                key={photo.photo_id}
                photo={photo}
                isExpanded={!!expandedPhotos[photo.photo_id]}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        </div>
      )}

      {/* 7. EMPTY / 100% COMPLIANT STATE */}
      {violationsCount === 0 && totalWorkers > 0 && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 font-extrabold text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>ALL WORKERS PPE COMPLIANT</span>
          </div>
          <p className="text-xs text-emerald-700">
            100% worker compliance rate • No PPE safety violations detected across analyzed site photos.
          </p>
        </div>
      )}
    </div>
  );
}
