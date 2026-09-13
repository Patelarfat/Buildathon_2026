"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Eye,
  AlertCircle,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Trash2,
  Filter,
  FileText,
  Building2,
  UserCheck,
  UserPlus,
  Calendar,
  ChevronRight,
  Sparkles,
  RefreshCw,
  X,
  AlertTriangle,
  Tag,
} from "lucide-react";
import {
  Observation,
  ObservationType,
  PriorityLevel,
  ObservationStatus,
  ProjectDetail,
  User,
  getProject,
  getObservations,
  createObservation,
  updateObservation,
  deleteObservation,
  getUsers,
} from "../../../../lib/api";
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";

const OBSERVATION_TYPES: { value: ObservationType; label: string }[] = [
  { value: "PROGRESS", label: "Progress Tracking" },
  { value: "SAFETY", label: "Safety Issue" },
  { value: "QUALITY", label: "Quality Defect" },
  { value: "MATERIAL", label: "Material Discrepancy" },
  { value: "EQUIPMENT", label: "Equipment Fault / Maintenance" },
  { value: "GENERAL", label: "General Site Note" },
];

const PRIORITY_STYLES: Record<
  PriorityLevel,
  { label: string; badge: string; dot: string }
> = {
  LOW: {
    label: "Low Priority",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  },
  MEDIUM: {
    label: "Medium Priority",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-500",
  },
  HIGH: {
    label: "High Priority",
    badge: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
    dot: "bg-rose-500",
  },
};

const STATUS_STYLES: Record<
  ObservationStatus,
  { label: string; badge: string; icon: React.ElementType }
> = {
  OPEN: {
    label: "Open",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    icon: RefreshCw,
  },
  RESOLVED: {
    label: "Resolved",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
};

export default function ObservationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Form / Modal State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [createdBy, setCreatedBy] = useState<number | "">("");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [observationType, setObservationType] =
    useState<ObservationType>("SAFETY");
  const [priority, setPriority] = useState<PriorityLevel>("MEDIUM");
  const [status, setStatus] = useState<ObservationStatus>("OPEN");
  const [observedAt, setObservedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, obsData, usersData] = await Promise.all([
        getProject(projectId),
        getObservations(projectId),
        getUsers(),
      ]);
      setProject(projData);
      setObservations(obsData);
      setUsers(usersData);

      if (projData.sites.length > 0 && selectedSiteId === "") {
        setSelectedSiteId(projData.sites[0].id);
      }
      if (usersData.length > 0 && createdBy === "") {
        setCreatedBy(usersData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load observations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError("Title and description are required");
      return;
    }
    if (!selectedSiteId) {
      setFormError("Please select a construction site");
      return;
    }
    if (!createdBy) {
      setFormError("Please select the creator");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await createObservation({
        project_id: projectId,
        site_id: Number(selectedSiteId),
        area_id: selectedAreaId ? Number(selectedAreaId) : undefined,
        created_by: Number(createdBy),
        assigned_to: assignedTo ? Number(assignedTo) : undefined,
        observation_type: observationType,
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        observed_at: observedAt,
      });

      setShowForm(false);
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setStatus("OPEN");
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to log observation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    obsId: number,
    newStatus: ObservationStatus
  ) => {
    try {
      await updateObservation(obsId, { status: newStatus });
      setObservations((prev) =>
        prev.map((o) => (o.id === obsId ? { ...o, status: newStatus } : o))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (obsId: number) => {
    if (!confirm("Are you sure you want to delete this observation?")) return;
    try {
      await deleteObservation(obsId);
      setObservations((prev) => prev.filter((o) => o.id !== obsId));
    } catch (err: any) {
      alert(err.message || "Failed to delete observation");
    }
  };

  const currentSite = project?.sites.find(
    (s) => s.id === Number(selectedSiteId)
  );

  // Computed summary metrics
  const totalCount = observations.length;
  const openCount = observations.filter((o) => o.status === "OPEN").length;
  const inProgressCount = observations.filter(
    (o) => o.status === "IN_PROGRESS"
  ).length;
  const resolvedCount = observations.filter(
    (o) => o.status === "RESOLVED"
  ).length;

  // Filtered observations
  const filteredObservations = observations.filter((obs) => {
    if (statusFilter !== "ALL" && obs.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && obs.priority !== priorityFilter)
      return false;
    if (typeFilter !== "ALL" && obs.observation_type !== typeFilter)
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = obs.title.toLowerCase().includes(q);
      const matchDesc = obs.description.toLowerCase().includes(q);
      const matchType = obs.observation_type.toLowerCase().includes(q);
      const matchSite = obs.site?.name?.toLowerCase().includes(q);
      const matchArea = obs.area?.name?.toLowerCase().includes(q);
      const matchCreator = obs.creator?.name?.toLowerCase().includes(q);
      const matchAssignee = obs.assignee?.name?.toLowerCase().includes(q);
      return (
        matchTitle ||
        matchDesc ||
        matchType ||
        matchSite ||
        matchArea ||
        matchCreator ||
        matchAssignee
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#171717] font-sans antialiased pb-16">
      {/* Shared Project Context Header & Stationary Navigation */}
      <ProjectHeader
        projectId={projectId}
        projectName={project?.name || `Project #${projectId}`}
        status={project?.status}
        location={project?.location}
        siteCount={project?.sites?.length}
        areaCount={project?.sites?.reduce((acc, s) => acc + (s.areas?.length || 0), 0)}
        startDate={project?.start_date}
        endDate={project?.end_date}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Log Observation</span>
          </button>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight flex items-center gap-3">
            <span>Observations & Issues</span>
            <span className="text-xs bg-[#0B0F10] text-[#F5B82E] font-semibold px-2.5 py-0.5 rounded-full">
              {totalCount} Total
            </span>
          </h1>
          <p className="text-sm sm:text-base text-[#6B7280] font-normal leading-relaxed">
            Track site defects, quality snags, recurring bottlenecks, and field issues through resolution.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="text-xs font-semibold text-rose-700 hover:underline flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6B7280]">
              <span>TOTAL OBSERVATIONS</span>
              <Eye className="w-4 h-4 text-[#6B7280]" />
            </div>
            <div className="text-2xl font-bold text-[#171717]">{totalCount}</div>
            <div className="text-[11px] text-[#6B7280]">Logged field issues</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
              <span>OPEN</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">{openCount}</div>
            <div className="text-[11px] text-amber-700/80">Pending investigation</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-700">
              <span>IN PROGRESS</span>
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-900">{inProgressCount}</div>
            <div className="text-[11px] text-blue-700/80">Active remediation</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>RESOLVED</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900">{resolvedCount}</div>
            <div className="text-[11px] text-emerald-700/80">Closed & verified</div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search observations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl pl-9 pr-4 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Tabs */}
            <div className="flex items-center bg-[#F6F6F3] p-1 rounded-xl border border-[#E7E5E4] text-xs">
              {[
                { id: "ALL", label: "All" },
                { id: "OPEN", label: "Open" },
                { id: "IN_PROGRESS", label: "In Progress" },
                { id: "RESOLVED", label: "Resolved" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === tab.id
                      ? "bg-white text-[#171717] shadow-sm font-semibold"
                      : "text-[#6B7280] hover:text-[#171717]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#F5B82E] font-medium"
            >
              <option value="ALL">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#F5B82E] font-medium"
            >
              <option value="ALL">All Categories</option>
              {OBSERVATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#E7E5E4] rounded-2xl h-36 animate-pulse"
              />
            ))}
          </div>
        ) : filteredObservations.length === 0 ? (
          /* Premium Compact White Empty State */
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-8 sm:p-10 text-center max-w-lg mx-auto shadow-sm space-y-4 my-6">
            <div className="w-14 h-14 bg-amber-50 text-[#F5B82E] border border-amber-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Eye className="w-7 h-7 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#171717]">
                {searchQuery ||
                statusFilter !== "ALL" ||
                priorityFilter !== "ALL" ||
                typeFilter !== "ALL"
                  ? "No matching observations found"
                  : "No Observations Yet"}
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed max-w-sm mx-auto">
                {searchQuery ||
                statusFilter !== "ALL" ||
                priorityFilter !== "ALL" ||
                typeFilter !== "ALL"
                  ? "Try adjusting your search criteria or filter controls."
                  : "Capture field defects, quality snags, material issues, and operational blockers as they arise."}
              </p>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setPriorityFilter("ALL");
                  setTypeFilter("ALL");
                  setShowForm(true);
                }}
                className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Log First Observation</span>
              </button>

              <span className="text-[11px] text-[#6B7280]">
                Recorded observations will appear here for tracking and resolution.
              </span>
            </div>
          </div>
        ) : (
          /* Observations List / Cards */
          <div className="space-y-4">
            {filteredObservations.map((obs) => {
              const priorityCfg =
                PRIORITY_STYLES[obs.priority] || PRIORITY_STYLES.LOW;
              const statusCfg =
                STATUS_STYLES[obs.status] || STATUS_STYLES.OPEN;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={obs.id}
                  className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-amber-300/50 transition-all space-y-4 group"
                >
                  {/* Top Card Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Priority Badge */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold flex items-center space-x-1.5 ${priorityCfg.badge}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`}
                        />
                        <span>{obs.priority} PRIORITY</span>
                      </span>

                      {/* Title */}
                      <h3 className="text-base font-bold text-[#171717]">
                        {obs.title}
                      </h3>

                      {/* Type Pill */}
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                        <Tag className="w-3 h-3" />
                        <span>{obs.observation_type}</span>
                      </span>

                      {/* Site & Area */}
                      <span className="text-xs text-[#6B7280] font-medium px-2 py-0.5 rounded bg-[#F6F6F3] border border-[#E7E5E4] flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-[#6B7280]" />
                        <span>
                          {obs.site?.name || `Site #${obs.site_id}`}
                          {obs.area && ` · ${obs.area.name}`}
                        </span>
                      </span>
                    </div>

                    {/* Right Action Tools */}
                    <div className="flex items-center space-x-3">
                      {/* Quick Status Selector */}
                      <select
                        value={obs.status}
                        onChange={(e) =>
                          handleStatusChange(
                            obs.id,
                            e.target.value as ObservationStatus
                          )
                        }
                        className="text-xs font-semibold rounded-xl px-2.5 py-1.5 bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>

                      <button
                        onClick={() => handleDelete(obs.id)}
                        className="p-1.5 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Observation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body Description */}
                  <div className="bg-[#F6F6F3]/70 p-3.5 rounded-xl border border-[#E7E5E4]">
                    <p className="text-xs text-[#171717] whitespace-pre-line leading-relaxed">
                      {obs.description}
                    </p>
                  </div>

                  {/* Card Footer Metadata */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#6B7280] pt-2 border-t border-[#E7E5E4] gap-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="flex items-center space-x-1">
                        <UserCheck className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>
                          Reported by:{" "}
                          <strong className="text-[#171717] font-medium">
                            {obs.creator?.name || `User #${obs.created_by}`}
                          </strong>
                        </span>
                      </span>

                      {obs.assignee && (
                        <span className="flex items-center space-x-1">
                          <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                          <span>
                            Assigned to:{" "}
                            <strong className="text-blue-700 font-medium">
                              {obs.assignee.name}
                            </strong>
                          </span>
                        </span>
                      )}

                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>
                          Observed:{" "}
                          {obs.observed_at || obs.created_at.slice(0, 10)}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center text-xs font-semibold text-[#171717] group-hover:text-[#F5B82E] transition-colors cursor-pointer">
                      <span>View Details</span>
                      <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Observation Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F10]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#F5B82E] border border-amber-200 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#171717]">
                    Log Site Observation / Issue
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Capture field defects, quality snags, or operational blockers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-[#6B7280] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#F6F6F3] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Observation Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Honeycombing noticed in Column C4, North Wing"
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Construction Site *
                  </label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => {
                      setSelectedSiteId(Number(e.target.value));
                      setSelectedAreaId("");
                    }}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                    required
                  >
                    <option value="">Select Site</option>
                    {project?.sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Specific Area (Optional)
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) =>
                      setSelectedAreaId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    <option value="">Overall Site</option>
                    {currentSite?.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.area_type || "Zone"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Reported By *
                  </label>
                  <select
                    value={createdBy}
                    onChange={(e) => setCreatedBy(Number(e.target.value))}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                    required
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Assign To (Optional)
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) =>
                      setAssignedTo(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Category / Type *
                  </label>
                  <select
                    value={observationType}
                    onChange={(e) =>
                      setObservationType(e.target.value as ObservationType)
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    {OBSERVATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Priority Level *
                  </label>
                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as PriorityLevel)
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High (Urgent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Current Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as ObservationStatus)
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Observed Date
                </label>
                <input
                  type="date"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Detailed Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the root issue, dimensions, affected components, and requested remediation..."
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#171717] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] disabled:opacity-50 text-[#0B0F10] text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {submitting ? "Logging..." : "Log Observation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
