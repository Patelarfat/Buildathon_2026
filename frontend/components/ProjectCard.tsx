"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Project, ProjectStatus } from "../lib/api";
import { MapPin, Building2, Grid, Calendar, ArrowRight, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { useRole } from "../lib/RoleContext";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: number) => void;
  onEdit?: (project: Project) => void;
}

export const statusColors: Record<ProjectStatus, { bg: string; text: string; border: string; dot: string }> = {
  PLANNING: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
  ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  ON_HOLD: { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200", dot: "bg-orange-500" },
  COMPLETED: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-400" },
};

export default function ProjectCard({ project, onDelete, onEdit }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { roleConfig } = useRole();

  const statusStyle = statusColors[project.status] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatStatusLabel = (status: ProjectStatus) => {
    switch (status) {
      case "ACTIVE":
        return "Active";
      case "PLANNING":
        return "Planning";
      case "ON_HOLD":
        return "On Hold";
      case "COMPLETED":
        return "Completed";
      default:
        return status;
    }
  };

  return (
    <div className="bg-white border border-[#E4E7EC] hover:border-slate-300 rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-sm hover:shadow-md flex flex-col md:flex-row gap-6 items-stretch group">
      
      {/* Left Column: Project Construction Photography Thumbnail */}
      <div
        className="w-full md:w-56 h-44 md:h-auto rounded-xl bg-slate-200 bg-cover bg-center shrink-0 border border-slate-200 relative overflow-hidden min-h-[140px]"
        style={{ backgroundImage: `url('/hero-construction.jpg')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#0B0F14]/75 text-white backdrop-blur-sm text-[10px] font-semibold px-2.5 py-1 rounded-md border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active construction</span>
        </div>
      </div>

      {/* Right Column: Main Info & Actions */}
      <div className="flex-1 flex flex-col justify-between space-y-4">
        
        {/* Top Header Row: Name, Location, Status Pill & Menu */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-xl font-bold text-[#111827] group-hover:text-[#D99A16] transition-colors line-clamp-1">
              {project.name}
            </h3>

            <div className="flex items-center space-x-2 shrink-0 relative" ref={menuRef}>
              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {formatStatusLabel(project.status)}
              </span>

              {/* Overflow Actions Menu Button */}
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-[#E4E7EC] flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                title="Project Actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {/* Overflow Menu Dropdown */}
              {showMenu && (
                <div className="absolute right-0 top-9 w-40 bg-white border border-[#E4E7EC] rounded-xl shadow-xl z-20 py-1 space-y-0.5 text-xs text-slate-700">
                  {onEdit && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(project);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 font-medium"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Project</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(project.id);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium border-t border-slate-100"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Delete Project</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{project.location || "Solapur, Maharashtra"}</span>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-[#667085] line-clamp-2 pt-1 font-normal leading-relaxed">
            {project.description || "Construction and infrastructure development project with multiple active sites and field operations."}
          </p>
        </div>

        {/* Middle Row: Structured Metadata Grid (Sites, Areas, Timeline) */}
        <div className="grid grid-cols-3 gap-3 py-3 px-4 bg-[#F8FAFC] border border-[#E4E7EC]/80 rounded-xl text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              SITES
            </span>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-900 text-sm">01</span>
            </div>
          </div>

          <div className="space-y-0.5 border-l border-slate-200/80 pl-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              AREAS
            </span>
            <div className="flex items-center gap-1.5">
              <Grid className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-900 text-sm">00</span>
            </div>
          </div>

          <div className="space-y-0.5 border-l border-slate-200/80 pl-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
              TIMELINE
            </span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-900 text-xs truncate">
                {project.start_date || "Dec 2026"} — {project.end_date || "Dec 2027"}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Row: Actions */}
        <div className="flex items-center justify-end space-x-3 pt-1">
          {onEdit && (
            <button
              onClick={() => onEdit(project)}
              className="px-4 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-[#E4E7EC] rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          <Link
            href={roleConfig.defaultLandingPath(project.id)}
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold bg-[#F5B82E] hover:bg-[#D99A16] text-[#0B0F14] transition-all shadow-sm active:scale-[0.98]"
          >
            <span>Open project</span>
            <ArrowRight className="w-4 h-4 text-[#0B0F14]" />
          </Link>
        </div>

      </div>
    </div>
  );
}

