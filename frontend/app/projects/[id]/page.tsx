"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ProjectDetail,
  ProjectStatus,
  ActivityItem,
  getProject,
  getProjectActivity,
  updateProject,
  deleteProject,
} from "../../../lib/api";
import { statusColors } from "../../../components/ProjectCard";
import ProjectNav from "../../../components/ProjectNav";
import SiteList from "../../../components/SiteList";
import MemberList from "../../../components/MemberList";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit project state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const loadProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, activityData] = await Promise.all([
        getProject(projectId),
        getProjectActivity(projectId).catch(() => []),
      ]);
      setProject(projData);
      setActivities(activityData);
      setName(projData.name);
      setDescription(projData.description || "");
      setLocation(projData.location || "");
      setStatus(projData.status);
      setStartDate(projData.start_date || "");
      setEndDate(projData.end_date || "");
    } catch (err: any) {
      setError(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProject(projectId, {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        status,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      setProject((prev) => (prev ? { ...prev, ...updated } : null));
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || "Failed to update project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this project? All associated sites, areas, and memberships will be removed."
      )
    ) {
      return;
    }

    try {
      await deleteProject(projectId);
      router.push("/projects");
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-800 rounded w-1/4"></div>
          <div className="h-40 bg-slate-900 border border-slate-800 rounded-2xl"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl"></div>
            <div className="h-64 bg-slate-900 border border-slate-800 rounded-2xl"></div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-rose-950/40 border border-rose-800 rounded-2xl p-8">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Project Not Found</h2>
          <p className="text-sm text-rose-300 mb-6">{error || "Could not retrieve project data."}</p>
          <Link
            href="/projects"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
          >
            ← Back to Projects
          </Link>
        </div>
      </main>
    );
  }

  const statusStyle = statusColors[project.status] || {
    bg: "bg-slate-800",
    text: "text-slate-300",
    border: "border-slate-700",
  };

  const fieldModules = [
    { title: "Site Photos", desc: "Inspection & visual captures", icon: "📸", href: `/projects/${projectId}/photos`, count: activities.filter(a => a.type === "PHOTO").length },
    { title: "Daily Reports", desc: "Shift progress & manpower logs", icon: "📋", href: `/projects/${projectId}/daily-reports`, count: activities.filter(a => a.type === "REPORT").length },
    { title: "Safety Incidents", desc: "PPE & hazard violation logs", icon: "⚠️", href: `/projects/${projectId}/incidents`, count: activities.filter(a => a.type === "INCIDENT").length },
    { title: "Inspections", desc: "Quality & equipment audits", icon: "🔍", href: `/projects/${projectId}/inspections`, count: activities.filter(a => a.type === "INSPECTION").length },
    { title: "Observations", desc: "Defects & recurring snags", icon: "👁️", href: `/projects/${projectId}/observations`, count: activities.filter(a => a.type === "OBSERVATION").length },
    { title: "Materials", desc: "Stock & delivery inventory", icon: "🧱", href: `/projects/${projectId}/materials`, count: activities.filter(a => a.type === "MATERIAL").length },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link href="/projects" className="hover:text-white">
            Projects
          </Link>
          <span>/</span>
          <span className="text-slate-200 font-medium truncate max-w-xs">{project.name}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors"
          >
            {isEditing ? "Cancel Edit" : "Edit Project"}
          </button>
          <button
            onClick={handleDelete}
            className="px-3.5 py-1.5 text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-lg transition-colors"
          >
            Delete Project
          </button>
        </div>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Edit Form or Info Card */}
      {isEditing ? (
        <form
          onSubmit={handleUpdate}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4"
        >
          <h3 className="text-lg font-bold text-white">Update Project Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {saving ? "Saving..." : "Save Project"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {project.name}
                </h1>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                >
                  {project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400 block">📍 Location</span>
              <span className="text-xs font-semibold text-white mt-1 block">
                {project.location || "Not specified"}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400 block">📅 Start Date</span>
              <span className="text-xs font-semibold text-white mt-1 block">
                {project.start_date || "Not set"}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400 block">🏁 Target Completion</span>
              <span className="text-xs font-semibold text-white mt-1 block">
                {project.end_date || "Not set"}
              </span>
            </div>
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <span className="text-[11px] font-medium text-slate-400 block">📊 Sites & Members</span>
              <span className="text-xs font-semibold text-white mt-1 block">
                {project.sites.length} Sites · {project.members.length} Members
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Field Data Modules Quick Navigation Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>📡 Field Data Collection Modules (Phase 3)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {fieldModules.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="text-2xl mb-2">{mod.icon}</div>
                <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                  {mod.title}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {mod.desc}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Records:</span>
                <span className="font-bold text-blue-400 bg-blue-950/50 border border-blue-900/50 px-1.5 py-0.2 rounded">
                  {mod.count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Grid: Sites on Left/Top, Members on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Sites & Areas */}
        <SiteList
          projectId={project.id}
          sites={project.sites || []}
          onSitesChanged={loadProject}
        />

        {/* Project Members */}
        <MemberList
          projectId={project.id}
          members={project.members || []}
          onMembersChanged={loadProject}
        />
      </div>

      {/* Unified Activity Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <span>⚡ Recent Project Activity & Evidence Stream</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
              {activities.length} Events
            </span>
          </h3>
          <span className="text-xs text-slate-400">Real-Time Traceability</span>
        </div>

        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center italic">
            No field activity recorded yet. Start by uploading site photos, logging daily reports, or recording inspections.
          </p>
        ) : (
          <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto pr-1">
            {activities.slice(0, 15).map((act, idx) => (
              <div key={idx} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="flex items-start space-x-3">
                  <span className="text-base mt-0.5">
                    {act.type === "PHOTO" && "📸"}
                    {act.type === "REPORT" && "📋"}
                    {act.type === "INCIDENT" && "⚠️"}
                    {act.type === "INSPECTION" && "🔍"}
                    {act.type === "OBSERVATION" && "👁️"}
                    {act.type === "MATERIAL" && "🧱"}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <strong className="text-slate-100">{act.title}</strong>
                      <span className="px-1.5 py-0.2 text-[10px] uppercase font-bold bg-slate-800 text-slate-300 rounded">
                        {act.type}
                      </span>
                    </div>
                    {act.description && (
                      <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-1">
                        {act.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-3 text-[10px] text-slate-500 mt-1">
                      {act.site_name && <span>Site: {act.site_name}</span>}
                      {act.area_name && <span>Area: {act.area_name}</span>}
                      {act.user_name && <span>By: {act.user_name}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 shrink-0">
                  <span>{act.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
