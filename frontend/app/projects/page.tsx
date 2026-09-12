"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Project, ProjectStatus, getProjects, deleteProject, updateProject } from "../../lib/api";
import ProjectCard from "../../components/ProjectCard";
import { Plus, Search, Folder, MapPin, BarChart3, Users, LayoutGrid, List, AlertCircle, HardHat } from "lucide-react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Project Modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("PLANNING");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this project? All associated sites and areas will be removed.")) {
      return;
    }

    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete project");
    }
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setEditName(proj.name);
    setEditDescription(proj.description || "");
    setEditLocation(proj.location || "");
    setEditStatus(proj.status);
    setEditStartDate(proj.start_date || "");
    setEditEndDate(proj.end_date || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setSavingEdit(true);
    try {
      const updated = await updateProject(editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        location: editLocation.trim() || undefined,
        status: editStatus,
        start_date: editStartDate || undefined,
        end_date: editEndDate || undefined,
      });

      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setEditingProject(null);
    } catch (err: any) {
      alert(err.message || "Failed to update project");
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = filterStatus === "ALL" || p.status === filterStatus;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const activeProjectsCount = projects.filter((p) => p.status === "ACTIVE").length;

  return (
    <main className="min-h-[calc(100vh-4.5rem)] bg-[#F7F8FA] text-slate-900 font-sans selection:bg-[#F5B82E] selection:text-[#0B0F14] pb-16">
      
      {/* Workspace Header Section */}
      <div className="bg-white border-b border-[#E4E7EC] py-8 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2.5">
                <span className="w-6 h-[2px] bg-[#F5B82E] inline-block" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  PROJECT PORTFOLIO
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
                Projects
              </h1>
              <p className="text-sm text-[#667085] max-w-xl font-normal">
                Your construction portfolio. Manage projects, sites and field operations from one workspace.
              </p>
            </div>

            <Link
              href="/projects/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#F5B82E] hover:bg-[#D99A16] text-[#0B0F14] transition-all shadow-sm active:scale-[0.98] self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 text-[#0B0F14]" />
              <span>New Project</span>
            </Link>
          </div>

          {/* Portfolio Summary Row */}
          {!loading && !error && projects.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
              <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl p-4 flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#E4E7EC] flex items-center justify-center text-slate-700 shrink-0">
                  <Folder className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#111827]">
                    {String(activeProjectsCount).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-slate-500 font-medium block">
                    Active Projects
                  </span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl p-4 flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#E4E7EC] flex items-center justify-center text-slate-700 shrink-0">
                  <MapPin className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#111827]">
                    {String(projects.length).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-slate-500 font-medium block">
                    Total Sites
                  </span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl p-4 flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#E4E7EC] flex items-center justify-center text-slate-700 shrink-0">
                  <BarChart3 className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#111827]">00</span>
                  <span className="text-xs text-slate-500 font-medium block">
                    Open Issues
                  </span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E4E7EC] rounded-xl p-4 flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-lg bg-white border border-[#E4E7EC] flex items-center justify-center text-slate-700 shrink-0">
                  <Users className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#111827]">01</span>
                  <span className="text-xs text-slate-500 font-medium block">
                    Team Members
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E4E7EC] rounded-xl pl-10 pr-12 py-2.5 text-xs sm:text-sm text-[#111827] placeholder-slate-400 focus:outline-none focus:border-[#F5B82E] transition-colors shadow-sm"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center space-x-0.5 pointer-events-none">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-400">
                ⌘
              </kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-400">
                K
              </kbd>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: "ALL", label: "All" },
              { id: "PLANNING", label: "Planning" },
              { id: "ACTIVE", label: "Active" },
              { id: "ON_HOLD", label: "On Hold" },
              { id: "COMPLETED", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs transition-all whitespace-nowrap ${
                  filterStatus === tab.id
                    ? "bg-[#F5B82E] text-[#0B0F14] font-bold shadow-sm"
                    : "bg-white hover:bg-slate-50 text-slate-600 border border-[#E4E7EC] font-semibold"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Counter & View Controls */}
        {!loading && !error && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-[#E4E7EC]/60">
            <span>
              {filteredProjects.length}{" "}
              {filteredProjects.length === 1 ? "project" : "projects"}
            </span>
            <div className="flex items-center space-x-3">
              <span className="hidden sm:inline">Sort by: <strong className="text-slate-700 font-semibold">Recently updated</strong></span>
              <div className="flex items-center space-x-1 bg-white border border-[#E4E7EC] rounded-lg p-1">
                <button className="p-1 bg-slate-900 text-white rounded shadow-xs" title="List View">
                  <List className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 text-slate-400 hover:text-slate-700 rounded" title="Grid View">
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center my-6 space-y-3">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-rose-900 font-bold text-sm">{error}</p>
              <p className="text-rose-600 text-xs mt-1">Unable to load project workspace. Please check your API connection.</p>
            </div>
            <button
              onClick={loadProjects}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#E4E7EC] rounded-2xl p-6 h-48 animate-pulse shadow-sm"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredProjects.length === 0 && (
          <div className="text-center py-16 bg-white border border-[#E4E7EC] rounded-2xl p-8 space-y-4 shadow-sm max-w-lg mx-auto my-8">
            <div className="w-12 h-12 bg-amber-100 text-[#D99A16] rounded-2xl flex items-center justify-center mx-auto">
              <Folder className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                {projects.length === 0 ? "No projects yet." : "No matching projects"}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {projects.length === 0
                  ? "Create your first construction project to start managing sites, field data and operational intelligence."
                  : "No projects match the selected filter or search query."}
              </p>
            </div>

            {projects.length === 0 ? (
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#F5B82E] hover:bg-[#D99A16] text-[#0B0F14] text-xs font-bold rounded-xl shadow-sm"
              >
                <Plus className="w-4 h-4 text-[#0B0F14]" />
                <span>Create Project</span>
              </Link>
            ) : (
              <button
                onClick={() => {
                  setFilterStatus("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-[#D99A16] hover:underline pt-2 block mx-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}

        {/* Project List */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="space-y-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDelete}
                onEdit={openEditModal}
              />
            ))}
          </div>
        )}

        {/* Bottom Inspirational Footer Widget (From Reference Mockup) */}
        <div className="mt-16 bg-[#FFFDF5] border border-[#F5E8C4] rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-900">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#F5B82E]/20 text-[#D99A16] flex items-center justify-center shrink-0">
              <HardHat className="w-6 h-6 text-[#D99A16]" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Build a smarter, safer tomorrow.</h4>
              <p className="text-xs text-slate-600 font-normal">Turn site data into actionable insights.</p>
            </div>
          </div>
          <div className="text-right border-t sm:border-t-0 sm:border-l border-[#F5E8C4] pt-3 sm:pt-0 sm:pl-6">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              CONSTRUCTION INTELLIGENCE
            </span>
            <span className="text-[11px] font-semibold text-slate-700">
              PEOPLE | PROJECTS | PROGRESS
            </span>
          </div>
        </div>

      </div>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E4E7EC] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Edit Project Information</h3>
              <button
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-slate-900">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-[#E4E7EC] rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#F5B82E] focus:bg-white transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-[#E4E7EC] rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#F5B82E] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Status *
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-slate-50 border border-[#E4E7EC] rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#F5B82E] focus:bg-white transition-colors"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-[#E4E7EC] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#F5B82E] focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-[#E4E7EC] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#F5B82E] focus:bg-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-[#E4E7EC] rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#F5B82E] focus:bg-white transition-colors"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-[#F5B82E] hover:bg-[#D99A16] disabled:opacity-50 text-[#0B0F14] text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

