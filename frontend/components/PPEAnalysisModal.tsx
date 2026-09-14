"use client";

import React, { useState } from "react";
import {
  AnalysisResult,
  SitePhoto,
  computePersonPPEReport,
  PersonPPEStatus,
  PPESummary,
  API_BASE,
} from "../lib/api";
import {
  X,
  Sparkles,
  Download,
  Check,
  AlertTriangle,
  Users,
  ShieldCheck,
  ShieldAlert,
  HardHat,
  Shirt,
  Hand,
  Footprints,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface PPEAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: AnalysisResult | null;
  photo: SitePhoto | null;
  onReRun?: () => void;
  reRunning?: boolean;
}

export default function PPEAnalysisModal({
  isOpen,
  onClose,
  analysis,
  photo,
  onReRun,
  reRunning = false,
}: PPEAnalysisModalProps) {
  const [imageTab, setImageTab] = useState<"annotated" | "original">("annotated");

  if (!isOpen || !analysis || !photo) return null;

  // Resolve person-wise report data from backend API or compute using client-side fallback
  let people: PersonPPEStatus[] = analysis.people || [];
  let summary: PPESummary | undefined = analysis.summary;

  if (!people || people.length === 0) {
    const computed = computePersonPPEReport(analysis.detections || []);
    people = computed.people;
    summary = computed.summary;
  }

  if (!summary) {
    const workersDetected = people.length;
    const fullyCompliant = people.filter((p) => p.compliant).length;
    const workersWithViolations = people.filter((p) => !p.compliant).length;
    const overallCompliance =
      workersDetected > 0 ? Math.round((fullyCompliant / workersDetected) * 100) : 100;

    summary = {
      workers_detected: workersDetected,
      fully_compliant: fullyCompliant,
      workers_with_violations: workersWithViolations,
      overall_compliance: overallCompliance,
    };
  }

  const handleDownloadReport = () => {
    const reportText = `PPE ANALYSIS COMPLIANCE REPORT\n` +
      `Date: ${new Date().toLocaleString()}\n` +
      `Workers Detected: ${summary?.workers_detected}\n` +
      `Fully Compliant: ${summary?.fully_compliant}\n` +
      `Workers with Violations: ${summary?.workers_with_violations}\n` +
      `Overall Compliance: ${summary?.overall_compliance}%\n\n` +
      people
        .map(
          (p) =>
            `Person ${p.person_id} (${p.compliant ? "COMPLIANT" : "VIOLATION"})\n` +
            `  Helmet: ${p.helmet.detected ? `Detected (${Math.round((p.helmet.confidence || 0) * 100)}%)` : "Missing"}\n` +
            `  Vest: ${p.vest.detected ? `Detected (${Math.round((p.vest.confidence || 0) * 100)}%)` : "Missing"}\n` +
            `  Gloves: ${p.gloves.detected ? `Detected (${Math.round((p.gloves.confidence || 0) * 100)}%)` : "Missing"}\n` +
            `  Boots: ${p.boots.detected ? `Detected (${Math.round((p.boots.confidence || 0) * 100)}%)` : "Missing"}\n` +
            `  Violations: ${p.violations.length > 0 ? p.violations.join(", ") : "None"}\n`
        )
        .join("\n");

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ppe_report_photo_${photo.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formattedDate = photo.taken_at
    ? new Date(photo.taken_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      })
    : new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

  const procSecs = analysis.processing_time_ms
    ? (analysis.processing_time_ms / 1000).toFixed(1)
    : "1.8";

  const violatingWorkers = people.filter((p) => !p.compliant);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#E7E5E4] rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* 1. MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E5E4] bg-white sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#F5B82E]/15 border border-[#F5B82E]/30 flex items-center justify-center text-[#D99A16]">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#171717] tracking-tight flex items-center gap-2">
                  <span>AI PPE Analysis</span>
                  {reRunning && (
                    <span className="text-xs bg-[#F5B82E]/20 text-[#D99A16] px-2 py-0.5 rounded-md font-bold animate-pulse">
                      Analyzing...
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 font-normal">
                  Detected {summary.workers_detected} worker{summary.workers_detected !== 1 ? "s" : ""} • Analyzed in {procSecs} seconds
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-400">
                {formattedDate}
              </span>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* SCROLLABLE CONTENT BODY */}
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar bg-[#FAF9F6]">
            {/* 2. IMAGE ACTION BAR & PREVIEW */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-1.5 bg-[#E7E5E4]/60 p-1 rounded-xl">
                  <button
                    onClick={() => setImageTab("annotated")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 ${
                      imageTab === "annotated"
                        ? "bg-[#171717] text-white shadow-xs"
                        : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
                    <span>Annotated Boxes</span>
                  </button>
                  <button
                    onClick={() => setImageTab("original")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      imageTab === "original"
                        ? "bg-[#171717] text-white shadow-xs"
                        : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    Original Photo
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  {onReRun && (
                    <button
                      onClick={onReRun}
                      disabled={reRunning}
                      className="px-3 py-1.5 bg-white border border-[#E7E5E4] text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors shadow-2xs"
                    >
                      Re-run AI
                    </button>
                  )}
                  <button
                    onClick={handleDownloadReport}
                    className="px-3.5 py-1.5 bg-white border border-[#E7E5E4] text-slate-800 hover:bg-slate-50 text-xs font-bold rounded-xl transition-colors shadow-2xs flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Download Report</span>
                  </button>
                </div>
              </div>

              {/* IMAGE FRAME */}
              <div className="relative bg-[#171717] rounded-2xl border border-slate-800 p-2 flex items-center justify-center min-h-[300px] max-h-[460px] overflow-hidden shadow-inner">
                {imageTab === "annotated" && (analysis.annotated_image_url || photo.file_path) ? (
                  <img
                    src={`${API_BASE}${analysis.annotated_image_url || photo.file_path}`}
                    alt="AI Annotated PPE Bounding Boxes"
                    className="max-h-[440px] w-auto object-contain rounded-xl"
                  />
                ) : (
                  <img
                    src={`${API_BASE}${photo.file_path}`}
                    alt="Original Site Photo"
                    className="max-h-[440px] w-auto object-contain rounded-xl"
                  />
                )}
              </div>
            </div>

            {/* 3. WORKER PPE COMPLIANCE REPORT SECTION */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#171717] tracking-tight uppercase flex items-center space-x-2">
                  <span>👷 Worker PPE Compliance Report</span>
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {people.length} worker{people.length !== 1 ? "s" : ""} detected
                </span>
              </div>

              {people.length === 0 ? (
                <div className="bg-white border border-dashed border-[#E7E5E4] p-8 rounded-2xl text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600">No workers detected in this photo frame.</p>
                  <p className="text-xs text-slate-400">The vision model could not identify any personnel in the image.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {people.map((person, idx) => {
                    const isCompliant = person.compliant;
                    const confPct = Math.round(person.confidence * 100);

                    let summaryText = "Fully PPE Compliant";
                    let summarySubtext = "All safety equipment detected";

                    if (!isCompliant) {
                      const missingItems = [];
                      if (!person.helmet.detected) missingItems.push("Helmet");
                      if (!person.vest.detected) missingItems.push("Vest");
                      if (!person.gloves.detected) missingItems.push("Gloves");
                      if (!person.boots.detected) missingItems.push("Boots");

                      if (missingItems.length === 1) {
                        summaryText = `Missing ${missingItems[0]}`;
                      } else {
                        summaryText = `Missing ${missingItems.join(" & ")}`;
                      }
                      summarySubtext = `${person.violations.length} safety violation${person.violations.length > 1 ? "s" : ""} detected`;
                    }

                    return (
                      <div
                        key={person.person_id}
                        className={`bg-white border rounded-2xl p-4 shadow-xs space-y-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                          isCompliant
                            ? "border-l-4 border-l-emerald-500 border-[#E7E5E4]"
                            : "border-l-4 border-l-rose-500 border-[#E7E5E4]"
                        }`}
                      >
                        {/* Person Header */}
                        <div className="flex items-start justify-between pb-3 border-b border-[#F0EFEA]">
                          <div>
                            <h4 className="text-sm font-extrabold text-[#171717] tracking-tight">
                              Person {person.person_id}
                            </h4>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                              Confidence: {confPct}%
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase rounded-lg border flex items-center space-x-1 ${
                              isCompliant
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}
                          >
                            {isCompliant ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                            )}
                            <span>{isCompliant ? "COMPLIANT" : "VIOLATION"}</span>
                          </span>
                        </div>

                        {/* PPE Checklist Icons Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Helmet */}
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-between ${
                              person.helmet.detected
                                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                                : "bg-rose-50/60 border-rose-200 text-rose-900"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <HardHat
                                className={`w-3.5 h-3.5 ${
                                  person.helmet.detected ? "text-emerald-600" : "text-rose-500"
                                }`}
                              />
                              <span className="font-semibold text-[11px]">Helmet</span>
                            </div>
                            {person.helmet.detected ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>

                          {/* Vest */}
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-between ${
                              person.vest.detected
                                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                                : "bg-rose-50/60 border-rose-200 text-rose-900"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <Shirt
                                className={`w-3.5 h-3.5 ${
                                  person.vest.detected ? "text-emerald-600" : "text-rose-500"
                                }`}
                              />
                              <span className="font-semibold text-[11px]">Vest</span>
                            </div>
                            {person.vest.detected ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>

                          {/* Gloves */}
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-between ${
                              person.gloves.detected
                                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                                : "bg-rose-50/60 border-rose-200 text-rose-900"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <Hand
                                className={`w-3.5 h-3.5 ${
                                  person.gloves.detected ? "text-emerald-600" : "text-rose-500"
                                }`}
                              />
                              <span className="font-semibold text-[11px]">Gloves</span>
                            </div>
                            {person.gloves.detected ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>

                          {/* Boots */}
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-between ${
                              person.boots.detected
                                ? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
                                : "bg-rose-50/60 border-rose-200 text-rose-900"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <Footprints
                                className={`w-3.5 h-3.5 ${
                                  person.boots.detected ? "text-emerald-600" : "text-rose-500"
                                }`}
                              />
                              <span className="font-semibold text-[11px]">Boots</span>
                            </div>
                            {person.boots.detected ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-600" />
                            )}
                          </div>
                        </div>

                        {/* Person Card Footer Summary */}
                        <div
                          className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 ${
                            isCompliant
                              ? "bg-emerald-50/40 border-emerald-200 text-emerald-900"
                              : "bg-rose-50/40 border-rose-200 text-rose-900"
                          }`}
                        >
                          {isCompliant ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <div className="space-y-0.5 leading-tight">
                            <span className="font-bold block">{summaryText}</span>
                            <span className="text-[10px] text-slate-500 block">{summarySubtext}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. SITE PPE COMPLIANCE SUMMARY SECTION */}
            <div className="space-y-4 pt-4 border-t border-[#E7E5E4]">
              <h3 className="text-sm font-extrabold text-[#171717] tracking-tight uppercase">
                🚨 Site PPE Compliance Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1: Workers Detected */}
                <div className="bg-white border border-[#E7E5E4] p-4 rounded-2xl shadow-xs flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Workers Detected
                    </span>
                    <span className="text-2xl font-black text-[#171717] mt-0.5 block">
                      {summary.workers_detected}
                    </span>
                  </div>
                </div>

                {/* Metric 2: Fully Compliant */}
                <div className="bg-white border border-[#E7E5E4] p-4 rounded-2xl shadow-xs flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Fully Compliant
                    </span>
                    <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                      {summary.fully_compliant}
                    </span>
                  </div>
                </div>

                {/* Metric 3: Workers with Violations */}
                <div className="bg-white border border-[#E7E5E4] p-4 rounded-2xl shadow-xs flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      With Violations
                    </span>
                    <span className="text-2xl font-black text-rose-700 mt-0.5 block">
                      {summary.workers_with_violations}
                    </span>
                  </div>
                </div>

                {/* Metric 4: Overall Compliance */}
                <div className="bg-white border border-[#E7E5E4] p-4 rounded-2xl shadow-xs flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5B82E]/15 text-[#D99A16] flex items-center justify-center shrink-0 border border-[#F5B82E]/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="w-full">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                      Overall Compliance
                    </span>
                    <span className="text-2xl font-black text-[#171717] mt-0.5 block">
                      {summary.overall_compliance}%
                    </span>
                    {/* Animated Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        style={{ width: `${summary.overall_compliance}%` }}
                        className={`h-full rounded-full transition-all duration-500 ease-out ${
                          summary.overall_compliance >= 80
                            ? "bg-emerald-500"
                            : summary.overall_compliance >= 50
                            ? "bg-[#F5B82E]"
                            : "bg-rose-500"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. PPE VIOLATIONS REQUIRING ATTENTION SECTION */}
            <div className="space-y-3 pt-4 border-t border-[#E7E5E4]">
              <h3 className="text-sm font-extrabold text-[#171717] tracking-tight uppercase flex items-center space-x-2">
                <span>⚠ PPE Violations Requiring Attention</span>
              </h3>

              {violatingWorkers.length === 0 ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-semibold flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>✅ No PPE safety violations detected. All workers are compliant.</span>
                </div>
              ) : (
                <div className="p-5 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {violatingWorkers.map((p) => (
                      <div key={p.person_id} className="bg-white border border-rose-200 p-3.5 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">
                            Person {p.person_id}
                          </span>
                          <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-700 px-2 py-0.5 rounded">
                            {p.violations.length} Violation{p.violations.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <ul className="space-y-1 text-xs text-rose-700 font-medium pl-1">
                          {p.violations.map((v, i) => (
                            <li key={i} className="flex items-center space-x-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. MODAL FOOTER */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-[#E7E5E4] sticky bottom-0 z-10">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-[#E7E5E4] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
            >
              Close
            </button>

            <button
              onClick={handleDownloadReport}
              className="px-5 py-2.5 bg-[#171717] hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center space-x-2"
            >
              <FileText className="w-4 h-4 text-[#F5B82E]" />
              <span>Generate Full Report</span>
            </button>
          </div>
        </div>
      </div>
  );
}
