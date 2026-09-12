"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  SafetyIncident,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  ProjectDetail,
  User,
  getProject,
  getIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
  getUsers,
} from "../../../../lib/api";
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  Building2,
  Grid,
  Calendar,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  X,
  SlidersHorizontal,
  Info,
} from "lucide-react";

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: "PPE_VIOLATION", label: "PPE Violation (Missing Helmet/Vest/Harness)" },
  { value: "FALL", label: "Fall / Slip / Trip" },
  { value: "INJURY", label: "Worker Injury" },
  { value: "EQUIPMENT_ACCIDENT", label: "Heavy Machinery / Equipment Incident" },
  { value: "UNSAFE_BEHAVIOR", label: "Unsafe Work Behavior" },
  { value: "UNSAFE_CONDITION", label: "Hazardous Site Condition" },
  { value: "OTHER", label: "Other Safety Concern" },
];

export default function SafetyIncidentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [reportedBy, setReportedBy] = useState<number | "">("");
  const [incidentType, setIncidentType] = useState<IncidentType>("PPE_VIOLATION");
  const [severity, setSeverity] = useState<IncidentSeverity>("MEDIUM");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, incidentsData, usersData] = await Promise.all([
        getProject(projectId),
        getIncidents(projectId),
        getUsers(),
      ]);
      setProject(projData);
      setIncidents(incidentsData);
      setUsers(usersData);

      if (projData.sites.length > 0 && selectedSiteId === "") {
        setSelectedSiteId(projData.sites[0].id);
      }
      if (usersData.length > 0 && reportedBy === "") {
        setReportedBy(usersData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load safety incidents");
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
    if (!description.trim()) {
      setFormError("Description is required");
      return;
    }
    if (!selectedSiteId) {
      setFormError("Please select a construction site");
      return;
    }
    if (!reportedBy) {
      setFormError("Please select the reporter");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await createIncident({
        project_id: projectId,
        site_id: Number(selectedSiteId),
        area_id: selectedAreaId ? Number(selectedAreaId) : undefined,
        reported_by: Number(reportedBy),
        incident_date: incidentDate,
        incident_type: incidentType,
        severity,
        description: description.trim(),
        action_taken: actionTaken.trim() || undefined,
        status,
      });

      setShowForm(false);
      setDescription("");
      setActionTaken("");
      setStatus("OPEN");
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to log safety incident");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (incidentId: number, newStatus: IncidentStatus) => {
    try {
      await updateIncident(incidentId, { status: newStatus });
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === incidentId ? { ...inc, status: newStatus } : inc))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (incidentId: number) => {
    if (!confirm("Are you sure you want to delete this safety incident record?")) return;
    try {
      await deleteIncident(incidentId);
      setIncidents((prev) => prev.filter((i) => i.id !== incidentId));
    } catch (err: any) {
      alert(err.message || "Failed to delete incident");
    }
  };

  const currentSite = project?.sites.find((s) => s.id === Number(selectedSiteId));

  // Incident Filtering Logic
  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      searchQuery === "" ||
      inc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.incident_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.site?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || inc.status === statusFilter;
    const matchesSeverity = severityFilter === "ALL" || inc.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const openCount = incidents.filter((i) => i.status === "OPEN").length;
  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const reviewCount = incidents.filter((i) => i.status === "UNDER_REVIEW").length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED").length;

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-50 text-rose-700 border-rose-200 font-extrabold";
      case "HIGH":
        return "bg-orange-50 text-orange-800 border-orange-200 font-bold";
      case "MEDIUM":
        return "bg-amber-50 text-amber-800 border-amber-200 font-bold";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#171717]">
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
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-sm font-semibold rounded-xl transition-colors shadow-xs flex items-center space-x-2"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? "Close Form" : "Log Safety Incident"}</span>
          </button>
        }
      />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight">
            Safety & Incidents
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-normal leading-relaxed">
            Track, investigate and resolve safety issues across the construction site.
          </p>
        </div>

        {/* 2. SAFETY SUMMARY ROW (4 Compact Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E7E5E4] p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Open Incidents</span>
              <div className="text-3xl font-black text-[#171717] mt-1">{openCount}</div>
              <span className="text-xs text-slate-500 mt-1 block">
                {openCount === 0 ? "No active incidents" : `${openCount} requiring action`}
              </span>
            </div>
            <ShieldAlert className={`w-6 h-6 ${openCount > 0 ? "text-amber-500" : "text-slate-400"}`} />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Critical</span>
              <div className="text-3xl font-black text-[#171717] mt-1">{criticalCount}</div>
              <span className="text-xs text-slate-500 mt-1 block">
                {criticalCount === 0 ? "Zero critical" : `${criticalCount} critical hazard`}
              </span>
            </div>
            <AlertTriangle className={`w-6 h-6 ${criticalCount > 0 ? "text-rose-600" : "text-slate-400"}`} />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-4 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Under Review</span>
              <div className="text-2xl font-black text-[#171717] mt-0.5">{reviewCount}</div>
              <span className="text-[11px] text-slate-500 mt-1 block">In progress review</span>
            </div>
            <SlidersHorizontal className="w-5 h-5 text-slate-400" />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-4 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Resolved</span>
              <div className="text-2xl font-black text-[#171717] mt-0.5">{resolvedCount}</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Mitigated hazards</span>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* 3. SITE SAFETY STATUS PANEL */}
        <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${openCount === 0 ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
            <div>
              <strong className="text-slate-900 uppercase tracking-wider font-extrabold mr-2">
                SITE SAFETY STATUS:
              </strong>
              {openCount === 0 ? (
                <span className="text-emerald-700 font-semibold">
                  No active incidents — All recorded safety information is currently clear.
                </span>
              ) : (
                <span className="text-amber-800 font-semibold">
                  Active Safety Incidents Detected — {openCount} issues requiring investigation.
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
            Project #{projectId} Safety Log
          </span>
        </div>

        {/* 4. INCIDENT TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-[#E7E5E4] shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incidents by description, type, or site..."
              className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#171717] placeholder-slate-400 focus:outline-none focus:border-[#F5B82E]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <div className="flex items-center space-x-1">
              {["ALL", "OPEN", "UNDER_REVIEW", "RESOLVED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    statusFilter === st
                      ? "bg-[#171717] text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {st === "ALL" ? "All Status" : st.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#FAF9F6] border border-[#E7E5E4] rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#F5B82E]"
            >
              <option value="ALL">All Severity</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* 5. LOG SAFETY INCIDENT FORM MODAL */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
              <h3 className="text-base font-bold text-[#171717] tracking-tight">Record Safety Incident / Hazard</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Incident Date *
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Construction Site *
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    setSelectedSiteId(Number(e.target.value));
                    setSelectedAreaId("");
                  }}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Area (Optional)
                </label>
                <select
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                >
                  <option value="">Overall Site</option>
                  {currentSite?.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reported By *
                </label>
                <select
                  value={reportedBy}
                  onChange={(e) => setReportedBy(Number(e.target.value))}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                  required
                >
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Incident Type *
                </label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Severity Level *
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                >
                  <option value="LOW">Low (Minor / Near Miss)</option>
                  <option value="MEDIUM">Medium (Correction Required)</option>
                  <option value="HIGH">High (Immediate Hazard)</option>
                  <option value="CRITICAL">Critical (Severe / Work Stop)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Status *
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                >
                  <option value="OPEN">Open</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Incident Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What happened? Describe the violation, location, and individuals or equipment involved..."
                className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-slate-400 focus:outline-none focus:border-[#F5B82E]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Immediate Action Taken / Corrective Measures
              </label>
              <textarea
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                rows={2}
                placeholder="e.g. Work stopped immediately, replacement harness issued, warning logged"
                className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-slate-400 focus:outline-none focus:border-[#F5B82E]"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-2 border-t border-[#E7E5E4]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                {submitting ? "Logging..." : "Log Incident"}
              </button>
            </div>
          </form>
        )}

        {/* 6. INCIDENT FEED OR EMPTY STATE */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E7E5E4] rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : filteredIncidents.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white border border-dashed border-[#E7E5E4] rounded-2xl p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#171717]">No Safety Incidents</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Your project currently has no recorded safety incidents.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4.5 py-2 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-xs font-bold rounded-xl transition-colors shadow-xs inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log Safety Incident</span>
            </button>
            <p className="text-[11px] text-slate-400 block pt-1">
              Continue maintaining safe site operations and record incidents when they occur.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredIncidents.map((inc) => (
              <div
                key={inc.id}
                className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-all duration-200"
              >
                {/* Header & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`text-[10px] uppercase px-2.5 py-1 rounded-full border ${getSeverityBadgeClass(inc.severity)}`}>
                      ● {inc.severity} SEVERITY
                    </span>
                    <span className="text-sm font-extrabold text-[#171717]">
                      {inc.incident_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {inc.site?.name || `Site #${inc.site_id}`}
                      {inc.area && ` · ${inc.area.name}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={inc.status}
                      onChange={(e) => handleStatusChange(inc.id, e.target.value as IncidentStatus)}
                      className={`text-xs font-extrabold rounded-lg px-2.5 py-1 bg-white border ${
                        inc.status === "RESOLVED"
                          ? "border-emerald-300 text-emerald-700"
                          : inc.status === "UNDER_REVIEW"
                          ? "border-amber-300 text-amber-800"
                          : "border-rose-300 text-rose-700"
                      }`}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="UNDER_REVIEW">UNDER REVIEW</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>

                    <button
                      onClick={() => handleDelete(inc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Incident Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Description & Action Taken */}
                <div className="space-y-3 text-xs">
                  <p className="text-slate-800 font-medium leading-relaxed">{inc.description}</p>
                  {inc.action_taken && (
                    <div className="p-3.5 bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl space-y-1">
                      <span className="text-xs font-bold text-slate-900 block">Corrective Action Taken:</span>
                      <p className="text-slate-700 leading-relaxed">{inc.action_taken}</p>
                    </div>
                  )}
                </div>

                {/* Metadata Footer */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-[#E7E5E4]">
                  <div className="flex items-center space-x-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reported by: <strong className="text-slate-900">{inc.reporter?.name || `User #${inc.reported_by}`}</strong></span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Date: <strong className="text-slate-900">{inc.incident_date}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
