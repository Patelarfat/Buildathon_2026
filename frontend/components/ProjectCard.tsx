"use client";

import Link from "next/link";
import { Project, ProjectStatus } from "../lib/api";

interface ProjectCardProps {
  project: Project;
  onDelete: (id: number) => void;
  onEdit?: (project: Project) => void;
}

export const statusColors: Record<ProjectStatus, { bg: string; text: string; border: string }> = {
  PLANNING: { bg: "bg-blue-900/30", text: "text-blue-400", border: "border-blue-500/30" },
  ACTIVE: { bg: "bg-emerald-900/30", text: "text-emerald-400", border: "border-emerald-500/30" },
  ON_HOLD: { bg: "bg-amber-900/30", text: "text-amber-400", border: "border-amber-500/30" },
  COMPLETED: { bg: "bg-purple-900/30", text: "text-purple-400", border: "border-purple-500/30" },
};

export default function ProjectCard({ project, onDelete, onEdit }: ProjectCardProps) {
  const statusStyle = statusColors[project.status] || {
    bg: "bg-slate-800",
    text: "text-slate-300",
    border: "border-slate-700",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
            {project.name}
          </h3>
          <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
          >
            {project.status}
          </span>
        </div>

        {project.description && (
          <p className="text-sm text-slate-400 line-clamp-2 mb-4">
            {project.description}
          </p>
        )}

        <div className="space-y-2 text-xs text-slate-400 mb-6 bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium">📍 Location:</span>
            <span className="text-slate-300 font-medium">{project.location || "Not specified"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-medium">📅 Timeline:</span>
            <span className="text-slate-300 font-medium">
              {project.start_date || "N/A"} → {project.end_date || "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-800">
        <Link
          href={`/projects/${project.id}`}
          className="flex-1 text-center py-2 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm shadow-blue-600/30"
        >
          View Details
        </Link>
        {onEdit && (
          <button
            onClick={() => onEdit(project)}
            className="py-2 px-3 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onDelete(project.id)}
          className="py-2 px-3 text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
