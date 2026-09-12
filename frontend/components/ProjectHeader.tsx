"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Building2, Grid, Calendar } from "lucide-react";
import ProjectNav from "./ProjectNav";

interface ProjectHeaderProps {
  projectId: number;
  projectName?: string | null;
  status?: string | null;
  location?: string | null;
  siteCount?: number;
  areaCount?: number;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  actions?: React.ReactNode;
}

const statusColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  PLANNING: { bg: "bg-[#FAF9F6]", text: "text-[#6B7280]", border: "border-[#E7E5E4]", dot: "bg-[#6B7280]" },
  ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-500 animate-pulse" },
  ON_HOLD: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
  COMPLETED: { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200", dot: "bg-blue-500" },
};

export default function ProjectHeader({
  projectId,
  projectName,
  status,
  location,
  siteCount = 0,
  areaCount = 0,
  startDate,
  endDate,
  description,
  actions,
}: ProjectHeaderProps) {
  const displayName = projectName || "Project Workspace";
  const displayStatus = status || "ACTIVE";
  const displayLocation = location || "Solapur, Maharashtra";
  const statusStyle = statusColors[displayStatus] || statusColors.ACTIVE;

  return (
    <div className="bg-white border-b border-[#E7E5E4]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-6 pb-5 space-y-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center space-x-2 text-sm font-semibold text-[#6B7280] pb-0.5">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-lg hover:bg-slate-100/70 hover:text-[#171717] transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-[#6B7280] shrink-0" />
            <span>Projects</span>
          </Link>
          <span className="text-slate-300 font-normal">/</span>
          <span className="text-[#171717] font-semibold">{displayName}</span>
        </div>

        {/* Title & Status & Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight">
                {displayName}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {displayStatus}
              </span>
            </div>
            {description && (
              <p className="text-sm sm:text-base text-[#6B7280] font-normal leading-relaxed max-w-3xl">
                {description}
              </p>
            )}
          </div>

          {/* Page-Specific Actions (CTA Buttons, Controls, Selectors) */}
          {actions && (
            <div className="flex flex-wrap items-center gap-3 shrink-0 self-start sm:self-auto">
              {actions}
            </div>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#6B7280] pt-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
            <span>{displayLocation}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
            <span>{siteCount} {siteCount === 1 ? "Site" : "Sites"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
            <span>{areaCount} {areaCount === 1 ? "Area" : "Areas"}</span>
          </div>
          {(startDate || endDate) && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
              <span>{startDate || "Dec 2026"} — {endDate || "Dec 2027"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Project Section Navigation Bar */}
      <ProjectNav projectId={projectId} />
    </div>
  );
}
