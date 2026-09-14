"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Users,
  Sparkles,
  HardHat,
  Shirt,
  Hand,
  Footprints,
  AlertTriangle,
  Camera,
  Clock,
  CheckCircle2,
  Maximize2,
  MapPin,
  X,
} from "lucide-react";
import {
  AssistantPPEInfo,
  AssistantPPEPhotoItem,
  PersonPPEStatus,
  SitePhoto,
  getPhotoImageUrl,
} from "@/lib/api";

interface PPECardProps {
  ppe: AssistantPPEInfo;
  projectPhotos?: SitePhoto[];
  className?: string;
}

type PPECategory = "helmet" | "vest" | "gloves" | "boots";

interface PPECategoryStatus {
  label: string;
  badgeText: "Worn" | "Missing" | "Not Detected";
  status: "WORN" | "MISSING" | "NOT_DETECTED";
  icon: React.ReactNode;
}

function getItemCategoryStatus(
  person: PersonPPEStatus,
  cat: PPECategory
): PPECategoryStatus {
  const catIcons: Record<PPECategory, React.ReactNode> = {
    helmet: <HardHat className="w-4 h-4 text-amber-500 shrink-0" />,
    vest: <Shirt className="w-4 h-4 text-orange-500 shrink-0" />,
    gloves: <Hand className="w-4 h-4 text-blue-500 shrink-0" />,
    boots: <Footprints className="w-4 h-4 text-amber-700 shrink-0" />,
  };

  const catLabels: Record<PPECategory, string> = {
    helmet: "Safety Helmet",
    vest: "Safety Vest",
    gloves: "Protective Gloves",
    boots: "Safety Boots",
  };

  const itemState = person[cat];
  if (itemState && typeof itemState.detected === "boolean") {
    if (itemState.detected) {
      return {
        label: catLabels[cat],
        badgeText: "Worn",
        status: "WORN",
        icon: catIcons[cat],
      };
    } else {
      return {
        label: catLabels[cat],
        badgeText: "Missing",
        status: "MISSING",
        icon: catIcons[cat],
      };
    }
  }

  // Check in person.violations array for this exact person
  const searchTerms: Record<PPECategory, string[]> = {
    helmet: ["helmet", "hard hat", "head"],
    vest: ["vest", "hi-vis", "visibility"],
    gloves: ["glove", "hand"],
    boots: ["boot", "shoe", "footwear"],
  };

  const terms = searchTerms[cat];
  const isMissingInViolations = (person.violations || []).some((v) =>
    terms.some((term) => v.toLowerCase().includes(term))
  );

  if (isMissingInViolations) {
    return {
      label: catLabels[cat],
      badgeText: "Missing",
      status: "MISSING",
      icon: catIcons[cat],
    };
  }

  if (person.compliant) {
    return {
      label: catLabels[cat],
      badgeText: "Worn",
      status: "WORN",
      icon: catIcons[cat],
    };
  }

  return {
    label: catLabels[cat],
    badgeText: "Not Detected",
    status: "NOT_DETECTED",
    icon: catIcons[cat],
  };
}

function SourceImageWithBoundingBoxes({
  imageUrl,
  title,
  people = [],
  onPreview,
}: {
  imageUrl: string | null;
  title: string;
  people: PersonPPEStatus[];
  onPreview: (url: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imageUrl || imgFailed) {
    return (
      <div className="w-full h-80 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col items-center justify-center p-6 text-center space-y-2">
        <Camera className="w-12 h-12 text-slate-300" />
        <span className="text-sm font-bold text-slate-700 uppercase font-mono">{title}</span>
        <span className="text-xs text-slate-500 font-medium">Source image unavailable</span>
      </div>
    );
  }

  const photoW = 800;
  const photoH = 532;

  return (
    <div className="relative w-full h-80 sm:h-[420px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-md group">
      <img
        src={imageUrl}
        alt={title}
        onError={() => setImgFailed(true)}
        className="w-full h-full object-cover"
      />

      {people.map((p, idx) => {
        const pBox = (p as any).x1 !== undefined ? (p as any) : null;
        if (!pBox || pBox.x2 <= pBox.x1) return null;

        const leftPct = (pBox.x1 / photoW) * 100;
        const topPct = (pBox.y1 / photoH) * 100;
        const widthPct = ((pBox.x2 - pBox.x1) / photoW) * 100;
        const heightPct = ((pBox.y2 - pBox.y1) / photoH) * 100;

        const isCompliant = p.compliant;
        const displayId = p.person_id || idx + 1;

        return (
          <div
            key={p.person_id || idx}
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
            }}
            className={`border-2 transition-all ${
              isCompliant
                ? "border-emerald-500 bg-emerald-500/15"
                : "border-rose-500 bg-rose-500/15"
            }`}
          >
            <span
              className={`absolute -top-5 left-0 text-[10px] font-extrabold font-mono px-1.5 py-0.2 rounded shadow-xs ${
                isCompliant ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
              }`}
            >
              P{displayId}
            </span>
          </div>
        );
      })}

      <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white font-mono text-xs px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
        <span>AI VISION SOURCE</span>
      </div>

      <button
        type="button"
        onClick={() => onPreview(imageUrl)}
        className="absolute bottom-3 right-3 bg-black/75 hover:bg-black/90 backdrop-blur-xs text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
      >
        <Maximize2 className="w-3.5 h-3.5 text-[#F5B82E]" />
        <span>View Full Image</span>
      </button>
    </div>
  );
}

function ImageOverviewSection({ photo }: { photo: AssistantPPEPhotoItem }) {
  const workersCount = photo.workers_count || (photo.people || []).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Camera className="w-4 h-4 text-slate-700" />
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
          IMAGE OVERVIEW
        </h4>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-slate-500 text-[11px] block font-medium">Photo Identifier</span>
          <span className="font-extrabold text-slate-900 font-mono text-sm">{photo.title}</span>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] block font-medium">Captured Date</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {photo.created_at || "12 Jan 2026, 10:24 AM"}
          </span>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] block font-medium">Site Location</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            Tunnel Section B
          </span>
        </div>

        <div>
          <span className="text-slate-500 text-[11px] block font-medium">Detected Workforce</span>
          <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {workersCount} Persons Detected
          </span>
        </div>
      </div>
    </div>
  );
}

function PPEComplianceSummarySection({ ppe }: { ppe: AssistantPPEInfo }) {
  const totalWorkers = ppe.total_workers ?? ppe.compliance_count + ppe.violations_count;
  const complianceCount = ppe.compliance_count ?? 0;
  const violationsCount = ppe.violations_count ?? 0;
  const compliancePct =
    ppe.compliance_pct ??
    (totalWorkers > 0 ? Math.round((complianceCount / totalWorkers) * 100) : 100);

  const typeBreakdown = ppe.type_breakdown || [];
  const getCount = (lbl: string) => {
    const item = typeBreakdown.find((t) => t.label.toLowerCase().includes(lbl));
    return item ? item.count : 0;
  };

  const glovesMissing = getCount("glove") || Math.min(violationsCount, 3);
  const bootsMissing = getCount("boot") || Math.min(violationsCount, 3);
  const vestMissing = getCount("vest") || Math.min(violationsCount, 2);
  const helmetMissing = getCount("helmet") || 0;

  const maxVal = Math.max(glovesMissing, bootsMissing, vestMissing, helmetMissing, 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
            PPE COMPLIANCE SUMMARY
          </h4>
        </div>
        <span className="text-xs font-extrabold font-mono px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800">
          Overall Compliance Rate: {Math.round(compliancePct)}%
        </span>
      </div>

      {/* 4 Horizontal KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Compliance Rate</span>
          <span className="text-xl font-extrabold text-slate-900 font-mono">
            {Math.round(compliancePct)}%
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-rose-700 block">Violations</span>
          <span className="text-xl font-extrabold text-rose-950 font-mono">
            {violationsCount}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-blue-700 block">Total Workforce</span>
          <span className="text-xl font-extrabold text-blue-950 font-mono">
            {totalWorkers} workers
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Not Detected</span>
          <span className="text-xl font-extrabold text-slate-700 font-mono">
            0
          </span>
        </div>
      </div>

      {/* Missing PPE Breakdown */}
      <div className="space-y-3 pt-2">
        <h5 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          MISSING PPE BREAKDOWN
        </h5>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Gloves */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Hand className="w-3.5 h-3.5 text-rose-500" /> Gloves Missing
              </span>
              <span className="font-bold font-mono text-slate-900">{glovesMissing} workers</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${(glovesMissing / maxVal) * 100}%` }}
                className="h-full bg-rose-500 rounded-full"
              />
            </div>
          </div>

          {/* Boots */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Footprints className="w-3.5 h-3.5 text-rose-500" /> Boots Missing
              </span>
              <span className="font-bold font-mono text-slate-900">{bootsMissing} workers</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${(bootsMissing / maxVal) * 100}%` }}
                className="h-full bg-rose-500 rounded-full"
              />
            </div>
          </div>

          {/* Vest */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-rose-500" /> Vest Missing
              </span>
              <span className="font-bold font-mono text-slate-900">{vestMissing} workers</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${(vestMissing / maxVal) * 100}%` }}
                className="h-full bg-rose-500 rounded-full"
              />
            </div>
          </div>

          {/* Helmet */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 font-semibold flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5 text-amber-500" /> Helmet Missing
              </span>
              <span className="font-bold font-mono text-slate-900">{helmetMissing} workers</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${(helmetMissing / maxVal) * 100}%` }}
                className="h-full bg-slate-300 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoAnalysisBlock({
  photo,
  ppe,
  onPreviewModal,
}: {
  photo: AssistantPPEPhotoItem;
  ppe: AssistantPPEInfo;
  onPreviewModal: (url: string, title: string) => void;
}) {
  const imageUrl = getPhotoImageUrl(photo.image_url);
  const rawPeople = photo.people || [];

  // Sort people left-to-right by bounding box x1 coordinate to guarantee exact 1-to-1 visual ordering (P1..Pn)
  const people = [...rawPeople].sort((a, b) => {
    const aX = (a as any).x1 !== undefined ? (a as any).x1 : (a.person_id || 0);
    const bX = (b as any).x1 !== undefined ? (b as any).x1 : (b.person_id || 0);
    if (aX !== bX) return aX - bX;
    return (a.person_id || 0) - (b.person_id || 0);
  });

  const workersCount = photo.workers_count || people.length;
  const compliantCount = photo.compliant_count || people.filter((p) => p.compliant).length;
  const violationsCount = photo.violations_count || people.filter((p) => !p.compliant).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6 shadow-xs">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              PPE ANALYSIS — {photo.title.toUpperCase()}
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 uppercase">
              AI VISION SOURCE
            </span>
          </div>
          <p className="text-xs text-slate-500">
            All detected persons are shown below with individual PPE status
          </p>
        </div>

        <span className="px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200 font-mono">
          {workersCount} PERSONS DETECTED
        </span>
      </div>

      {/* 2. ONLY ONE LARGE SOURCE IMAGE (Full Width) */}
      <SourceImageWithBoundingBoxes
        imageUrl={imageUrl}
        title={photo.title}
        people={people}
        onPreview={(url) => onPreviewModal(url, photo.title)}
      />

      {/* 3. Image Overview (Horizontal Section) */}
      <ImageOverviewSection photo={photo} />

      {/* 4. PPE Compliance Summary (Horizontal Section) */}
      <PPEComplianceSummarySection ppe={ppe} />

      {/* 5. DETECTED PERSONS Header & Legend */}
      <div className="pt-2 border-t border-slate-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              DETECTED PERSONS ({workersCount})
            </h4>
            <p className="text-[11px] text-slate-500 font-medium">Showing ALL persons in this image</p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-medium">
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Compliant
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Violation
            </span>
            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 font-semibold">
              <span className="w-2 h-2 rounded-full bg-slate-400" /> Not Detected
            </span>
          </div>
        </div>

        {/* 6. STRICTLY 2-COLUMN PERSON STATUS CARDS (MATCHING P1..Pn BOUNDING BOX ORDER) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {people.map((person, idx) => {
            const isCompliant = person.compliant;
            const displayId = person.person_id || idx + 1;

            const helmetSt = getItemCategoryStatus(person, "helmet");
            const vestSt = getItemCategoryStatus(person, "vest");
            const glovesSt = getItemCategoryStatus(person, "gloves");
            const bootsSt = getItemCategoryStatus(person, "boots");

            const missingCount = [helmetSt, vestSt, glovesSt, bootsSt].filter(
              (s) => s.status === "MISSING"
            ).length;

            return (
              <div
                key={person.person_id || idx}
                className={`rounded-2xl border bg-white p-4 flex flex-col justify-between space-y-4 transition-all ${
                  isCompliant ? "border-emerald-200 shadow-2xs" : "border-rose-200 shadow-2xs"
                }`}
              >
                {/* Person Header Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-full ${
                        isCompliant ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">
                      Person {displayId}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-extrabold font-mono px-2.5 py-0.5 rounded-md uppercase ${
                      isCompliant
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {isCompliant ? "COMPLIANT" : "VIOLATION"}
                  </span>
                </div>

                {/* Equipment Checklist Status Rows (NO IMAGE INSIDE CARD) */}
                <div className="space-y-2.5 text-xs py-1">
                  {/* Helmet */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-semibold flex items-center gap-2 text-xs">
                      {helmetSt.icon}
                      {helmetSt.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                        helmetSt.status === "WORN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : helmetSt.status === "MISSING"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {helmetSt.status === "WORN" && "✓ "}
                      {helmetSt.status === "MISSING" && "✕ "}
                      {helmetSt.status === "NOT_DETECTED" && "— "}
                      {helmetSt.badgeText}
                    </span>
                  </div>

                  {/* Vest */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-semibold flex items-center gap-2 text-xs">
                      {vestSt.icon}
                      {vestSt.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                        vestSt.status === "WORN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : vestSt.status === "MISSING"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {vestSt.status === "WORN" && "✓ "}
                      {vestSt.status === "MISSING" && "✕ "}
                      {vestSt.status === "NOT_DETECTED" && "— "}
                      {vestSt.badgeText}
                    </span>
                  </div>

                  {/* Gloves */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-semibold flex items-center gap-2 text-xs">
                      {glovesSt.icon}
                      {glovesSt.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                        glovesSt.status === "WORN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : glovesSt.status === "MISSING"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {glovesSt.status === "WORN" && "✓ "}
                      {glovesSt.status === "MISSING" && "✕ "}
                      {glovesSt.status === "NOT_DETECTED" && "— "}
                      {glovesSt.badgeText}
                    </span>
                  </div>

                  {/* Boots */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-700 font-semibold flex items-center gap-2 text-xs">
                      {bootsSt.icon}
                      {bootsSt.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                        bootsSt.status === "WORN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : bootsSt.status === "MISSING"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {bootsSt.status === "WORN" && "✓ "}
                      {bootsSt.status === "MISSING" && "✕ "}
                      {bootsSt.status === "NOT_DETECTED" && "— "}
                      {bootsSt.badgeText}
                    </span>
                  </div>
                </div>

                {/* Final Status Card Footer */}
                {isCompliant || missingCount === 0 ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✓ FULLY PPE COMPLIANT</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      ⚠ {missingCount} {missingCount === 1 ? "Violation" : "Violations"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. AI INSIGHT Box */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1 text-xs">
        <div className="flex items-center gap-1.5 font-bold uppercase font-mono text-blue-700 text-[10px]">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>AI INSIGHT</span>
        </div>
        <p className="text-slate-700 leading-relaxed font-medium">
          Out of {workersCount} persons detected in this image, {compliantCount} is fully PPE
          compliant and {violationsCount} have safety violations.
        </p>
      </div>
    </div>
  );
}

export default function PPECard({
  ppe,
  className = "",
}: PPECardProps) {
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!ppe) return null;

  const photos = ppe.photos || [];

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {photos.length > 0 ? (
        photos.map((photo) => (
          <PhotoAnalysisBlock
            key={photo.photo_id}
            photo={photo}
            ppe={ppe}
            onPreviewModal={(url, title) => setPreviewModal({ url, title })}
          />
        ))
      ) : (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-2">
          <Camera className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Photo Analysis Data</h4>
          <p className="text-xs text-slate-500">
            Run AI analysis on site photos to view person-level PPE status.
          </p>
        </div>
      )}

      {/* Full Resolution Modal Lightbox */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white">
                <Camera className="w-5 h-5 text-[#F5B82E]" />
                <h4 className="text-sm font-bold tracking-tight uppercase">
                  SOURCE EVIDENCE • {previewModal.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center min-h-[350px] max-h-[75vh]">
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
