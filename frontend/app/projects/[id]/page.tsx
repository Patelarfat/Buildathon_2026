"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ProjectDetail,
  ProjectStatus,
  ActivityItem,
  AISummary,
  getProject,
  getProjectActivity,
  getProjectAISummary,
  updateProject,
  deleteProject,
} from "../../../lib/api";
import { statusColors } from "../../../components/ProjectCard";
import ProjectNav from "../../../components/ProjectNav";
import ProjectHeader from "../../../components/ProjectHeader";
import SiteList from "../../../components/SiteList";
import MemberList from "../../../components/MemberList";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Grid,
  Calendar,
  ShieldCheck,
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Bot,
  Camera,
  FileText,
  ShieldAlert,
  ClipboardCheck,
  AlertCircle,
  Package,
  ArrowRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Radio,
  Plus,
} from "lucide-react";

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
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

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
      const [projData, activityData, aiData] = await Promise.all([
        getProject(projectId),
        getProjectActivity(projectId).catch(() => []),
        getProjectAISummary(projectId).catch(() => null),
      ]);
      setProject(projData);
      setActivities(activityData);
      setAiSummary(aiData);
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
    } flex: {
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
      <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F6F3] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
          <div className="h-6 bg-[#E7E5E4] rounded w-1/6"></div>
          <div className="h-32 bg-white border border-[#E7E5E4] rounded-2xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white border border-[#E7E5E4] rounded-xl"></div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F6F3] py-16 text-center">
        <div className="max-w-md mx-auto bg-white border border-rose-200 rounded-2xl p-8 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-[#171717]">Project Not Found</h2>
          <p className="text-xs text-rose-600">{error || "Could not retrieve project data."}</p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] text-xs font-bold rounded-xl shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </Link>
        </div>
      </main>
    );
  }

  const statusStyle = statusColors[project.status] || {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  };

  const fieldModules = [
    { title: "Site Photos", desc: "Inspection & visual captures", icon: Camera, href: `/projects/${projectId}/photos`, count: activities.filter(a => a.type === "PHOTO").length },
    { title: "Daily Reports", desc: "Shift progress & manpower logs", icon: FileText, href: `/projects/${projectId}/daily-reports`, count: activities.filter(a => a.type === "REPORT").length },
    { title: "Safety Incidents", desc: "PPE & hazard violation logs", icon: ShieldAlert, href: `/projects/${projectId}/incidents`, count: activities.filter(a => a.type === "INCIDENT").length },
    { title: "Inspections", desc: "Quality & equipment audits", icon: ClipboardCheck, href: `/projects/${projectId}/inspections`, count: activities.filter(a => a.type === "INSPECTION").length },
    { title: "Observations", desc: "Defects & recurring snags", icon: AlertCircle, href: `/projects/${projectId}/observations`, count: activities.filter(a => a.type === "OBSERVATION").length },
    { title: "Materials", desc: "Stock & delivery inventory", icon: Package, href: `/projects/${projectId}/materials`, count: activities.filter(a => a.type === "MATERIAL").length },
  ];

  const openIssuesCount = aiSummary?.open_findings ?? 0;
  const highSeverityCount = aiSummary?.high_severity ?? 0;

  return (
    <main className="min-h-[calc(100vh-4.5rem)] bg-[#F6F6F3] text-[#171717] font-sans selection:bg-[#F5B82E] selection:text-[#0B0F10] pb-16">
      
      {/* Shared Project Context Header & Stationary Navigation */}
      <ProjectHeader
        projectId={projectId}
        projectName={project.name}
        status={project.status}
        location={project.location}
        siteCount={project.sites.length}
        areaCount={project.sites.reduce((acc, s) => acc + (s.areas?.length || 0), 0)}
        startDate={project.start_date}
        endDate={project.end_date}
        description={project.description}
        actions={
          <div className="flex items-center space-x-2 relative">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white hover:bg-[#F6F6F3] text-[#171717] border border-[#E7E5E4] rounded-xl transition-colors shadow-xs"
            >
              <Edit className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>{isEditing ? "Cancel Edit" : "Edit Project"}</span>
            </button>

            <button
              onClick={() => setShowOverflowMenu(!showOverflowMenu)}
              className="w-9 h-9 rounded-xl bg-white hover:bg-[#F6F6F3] border border-[#E7E5E4] flex items-center justify-center text-[#6B7280] hover:text-[#171717] transition-colors shadow-xs"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showOverflowMenu && (
              <div className="absolute right-0 top-11 w-44 bg-white border border-[#E7E5E4] rounded-xl shadow-xl z-30 py-1 text-xs">
                <button
                  onClick={() => {
                    setShowOverflowMenu(false);
                    handleDelete();
                  }}
                  className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delete Project</span>
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 space-y-8">

        {/* Edit Form Toggle Surface */}
        {isEditing && (
          <form
            onSubmit={handleUpdate}
            className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-sm space-y-4 text-[#171717]"
          >
            <h3 className="text-base font-bold text-[#171717] border-b border-[#E7E5E4] pb-2">Update Project Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#171717]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] disabled:opacity-50 text-[#0B0F10] text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                {saving ? "Saving..." : "Save Project"}
              </button>
            </div>
          </form>
        )}

        {/* 6. COMMAND CENTER KPI SUMMARY ROW */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#171717] tracking-tight">Project Overview</h2>
            <span className="text-xs text-[#6B7280]">Real-time operational status</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Project Risk */}
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                PROJECT RISK
              </span>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xl font-extrabold text-emerald-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Low
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Stable
                </span>
              </div>
            </div>

            {/* Progress */}
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                PROGRESS
              </span>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xl font-extrabold text-[#171717]">
                  76%
                </span>
                <span className="text-[10px] font-semibold text-[#6B7280]">
                  On track
                </span>
              </div>
            </div>

            {/* Open Issues */}
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                OPEN ISSUES
              </span>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xl font-extrabold text-[#171717]">
                  {String(openIssuesCount).padStart(2, "0")}
                </span>
                <span className="text-[10px] font-semibold text-[#6B7280]">
                  {highSeverityCount > 0 ? `${highSeverityCount} High` : "All Minor"}
                </span>
              </div>
            </div>

            {/* Field Activity */}
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 space-y-1 shadow-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] block">
                FIELD ACTIVITY
              </span>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xl font-extrabold text-[#171717]">
                  {String(activities.length).padStart(2, "0")}
                </span>
                <span className="text-[10px] font-semibold text-[#6B7280]">
                  Events logged
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 7. WHAT NEEDS ATTENTION? PANEL */}
        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E7E5E4] pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#171717] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F5B82E]" />
              <span>WHAT NEEDS ATTENTION?</span>
            </h3>
            <span className="text-xs text-[#6B7280] font-medium">Automated Site Monitor</span>
          </div>

          {openIssuesCount > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{openIssuesCount} safety observations or open findings require review on this job site.</span>
              </div>
              <Link
                href={`/projects/${projectId}/observations`}
                className="text-xs font-bold text-[#171717] hover:text-[#F5B82E] transition-colors shrink-0"
              >
                Review issues →
              </Link>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>✓ No critical alerts or urgent safety blockers detected on site. Operations are running normally.</span>
            </div>
          )}
        </div>

        {/* 11. PROJECT INTELLIGENCE & AI ASSISTANT PANEL */}
        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-[#171717] flex items-center gap-2">
                <Brain className="w-5 h-5 text-[#F5B82E]" />
                <span>PROJECT INTELLIGENCE</span>
              </h3>
              <p className="text-xs text-[#6B7280] font-normal">
                Multi-factor risk analytics, zone vulnerability rankings, and AI computer vision compliance stream.
              </p>
            </div>

            <div className="flex items-center space-x-3 self-start sm:self-auto">
              <Link
                href={`/projects/${projectId}/assistant`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F6F6F3] border border-[#E7E5E4] hover:bg-slate-100 text-[#171717] transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Ask AI Assistant</span>
              </Link>

              <Link
                href={`/projects/${projectId}/intelligence`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] transition-all shadow-xs"
              >
                <span>Open Intelligence</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#0B0F10]" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#F6F6F3] border border-[#E7E5E4] p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-[#6B7280] block">Photos Analyzed</span>
              <span className="text-lg font-extrabold text-[#171717] mt-1 block">
                {aiSummary?.photos_analyzed ?? 0} <span className="text-xs font-normal text-[#6B7280]">/ {aiSummary?.total_photos ?? 0}</span>
              </span>
            </div>

            <div className="bg-[#F6F6F3] border border-[#E7E5E4] p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-[#6B7280] block">AI Findings</span>
              <span className="text-lg font-extrabold text-[#171717] mt-1 block">
                {aiSummary?.total_findings ?? 0}
              </span>
            </div>

            <div className="bg-[#F6F6F3] border border-[#E7E5E4] p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-[#6B7280] block">High Severity</span>
              <span className="text-lg font-extrabold text-rose-600 mt-1 block">
                {aiSummary?.high_severity ?? 0}
              </span>
            </div>

            <div className="bg-[#F6F6F3] border border-[#E7E5E4] p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-[#6B7280] block">Resolved / Reviewed</span>
              <span className="text-lg font-extrabold text-emerald-700 mt-1 block">
                {aiSummary?.resolved_findings ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* 10. FIELD ACTIVITY & MODULES GRID */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#171717]">FIELD ACTIVITY MODULES</h3>
            <span className="text-xs text-[#6B7280]">Live operational modules</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {fieldModules.map((mod) => {
              const ModIcon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="bg-white border border-[#E7E5E4] hover:border-[#F5B82E] rounded-2xl p-4 transition-all flex flex-col justify-between group shadow-xs hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-[#F6F6F3] text-[#171717] flex items-center justify-center group-hover:bg-[#F5B82E] group-hover:text-[#0B0F10] transition-colors border border-[#E7E5E4]">
                      <ModIcon className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <h4 className="text-xs font-bold text-[#171717] group-hover:text-[#171717] transition-colors">
                      {mod.title}
                    </h4>
                    <p className="text-[10px] text-[#6B7280] leading-tight line-clamp-2">
                      {mod.desc}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-[#E7E5E4] flex items-center justify-between text-[11px]">
                    <span className="text-[#6B7280]">Records:</span>
                    <span className="font-bold text-[#171717] bg-[#F6F6F3] px-2 py-0.5 rounded-md border border-[#E7E5E4]">
                      {mod.count}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 9. SITES & MEMBERS MANAGEMENT (Two Column Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start scroll-mt-24">
          <div id="sites" className="scroll-mt-24">
            <div id="areas" className="scroll-mt-24">
              <SiteList
                projectId={project.id}
                sites={project.sites || []}
                onSitesChanged={loadProject}
              />
            </div>
          </div>

          <div id="team" className="scroll-mt-24">
            <MemberList
              projectId={project.id}
              members={project.members || []}
              onMembersChanged={loadProject}
            />
          </div>
        </div>

        {/* UNIFIED ACTIVITY FEED STREAM */}
        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#171717] flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-[#F5B82E]" />
              <span>RECENT PROJECT ACTIVITY STREAM</span>
            </h3>
            
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-[#6B7280] font-semibold">Real-Time Event Traceability</span>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-8 bg-[#F6F6F3]/60 rounded-2xl border border-[#E7E5E4] space-y-3 my-2">
              <div className="w-12 h-12 bg-amber-50 text-[#F5B82E] border border-amber-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <ActivityIcon className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#171717]">
                  No activity recorded yet
                </h4>
                <p className="text-xs text-[#6B7280] max-w-sm mx-auto mt-0.5">
                  Project activity will appear here as your team uploads site photos, submits daily reports, records inspections, and logs field observations.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href={`/projects/${projectId}/photos`}
                  className="px-3 py-1.5 bg-white hover:bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs font-semibold rounded-xl shadow-xs"
                >
                  Upload Site Photo
                </Link>
                <Link
                  href={`/projects/${projectId}/daily-reports`}
                  className="px-3 py-1.5 bg-white hover:bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs font-semibold rounded-xl shadow-xs"
                >
                  Create Daily Report
                </Link>
                <Link
                  href={`/projects/${projectId}/inspections`}
                  className="px-3 py-1.5 bg-white hover:bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs font-semibold rounded-xl shadow-xs"
                >
                  Record Inspection
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#E7E5E4] max-h-96 overflow-y-auto pr-1">
              {activities.slice(0, 15).map((act, idx) => (
                <div key={idx} className="py-3 flex items-start justify-between gap-4 text-xs hover:bg-[#FAF9F6] p-2 rounded-xl transition-colors">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-[#F6F6F3] border border-[#E7E5E4] flex items-center justify-center text-[#171717] shrink-0 mt-0.5">
                      {act.type === "PHOTO" && <Camera className="w-4 h-4 text-[#171717]" />}
                      {act.type === "REPORT" && <FileText className="w-4 h-4 text-[#171717]" />}
                      {act.type === "INCIDENT" && <ShieldAlert className="w-4 h-4 text-rose-600" />}
                      {act.type === "INSPECTION" && <ClipboardCheck className="w-4 h-4 text-blue-600" />}
                      {act.type === "OBSERVATION" && <AlertCircle className="w-4 h-4 text-amber-600" />}
                      {act.type === "MATERIAL" && <Package className="w-4 h-4 text-[#171717]" />}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <strong className="text-[#171717] font-bold">{act.title}</strong>
                        <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-[#F6F6F3] text-[#6B7280] rounded-md border border-[#E7E5E4]">
                          {act.type}
                        </span>
                      </div>
                      {act.description && (
                        <p className="text-[#6B7280] text-xs mt-0.5 line-clamp-1 font-normal">
                          {act.description}
                        </p>
                      )}
                      <div className="flex items-center space-x-3 text-[10px] text-[#6B7280] mt-1">
                        {act.site_name && <span>Site: {act.site_name}</span>}
                        {act.area_name && <span>Area: {act.area_name}</span>}
                        {act.user_name && <span>By: {act.user_name}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-[#6B7280] shrink-0">
                    <span>{act.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

