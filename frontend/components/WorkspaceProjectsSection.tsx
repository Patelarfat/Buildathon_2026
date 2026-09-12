"use client";

import Link from "next/link";
import { Project } from "../lib/api";
import { FolderKanban, MapPin, ArrowRight, Plus } from "lucide-react";

interface WorkspaceProjectsSectionProps {
  projects: Project[];
  loading: boolean;
}

export default function WorkspaceProjectsSection({
  projects,
  loading,
}: WorkspaceProjectsSectionProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "PLANNING":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ON_HOLD":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "COMPLETED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const formatStatusText = (status: string) => {
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
    <section className="py-16 sm:py-20 bg-white border-t border-[#E4E7EC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E4E7EC] pb-6">
          <div className="space-y-1">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Your Workspace
            </h2>
            <p className="text-sm text-slate-500 font-normal">
              Your active construction projects
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#D99A16] hover:text-[#B8800D] transition-colors shrink-0 self-start sm:self-auto"
          >
            <span>View all projects</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 bg-slate-100 rounded-xl border border-slate-200 animate-pulse p-6"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4 my-8 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-[#D99A16] flex items-center justify-center mx-auto">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">No projects yet.</h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Create your first construction project to start managing your sites, field data and safety intelligence.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-[#F5B82E] hover:bg-[#D99A16] text-[#0B0F14] transition-all shadow-sm"
              >
                <Plus className="w-4 h-4 text-[#0B0F14]" />
                <span>Create Project</span>
              </Link>
            </div>
          </div>
        )}

        {/* Project Cards Grid */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white border border-[#E4E7EC] hover:border-slate-300 rounded-xl p-5 space-y-4 flex flex-col justify-between transition-all duration-200 hover:shadow-md group"
              >
                <div className="space-y-3">
                  {/* Card Header & Thumbnail */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      {/* Construction Thumbnail */}
                      <div
                        className="w-12 h-12 rounded-lg bg-slate-200 bg-cover bg-center shrink-0 border border-slate-200"
                        style={{ backgroundImage: `url('/hero-construction.jpg')` }}
                      />
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-[#D99A16] transition-colors line-clamp-1">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-slate-500 pt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {project.location || "Solapur"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${getStatusBadge(
                        project.status
                      )}`}
                    >
                      {formatStatusText(project.status)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 pt-1">
                    {project.description || "1 Site · Active site operations and AI intelligence."}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E4E7EC] flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    1 Site · {formatStatusText(project.status)}
                  </span>
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 group-hover:text-[#D99A16] transition-colors"
                  >
                    <span>Open project</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

