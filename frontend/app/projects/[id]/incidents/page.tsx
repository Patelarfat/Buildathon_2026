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
import ProjectNav from "../../../../components/ProjectNav";

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: "PPE_VIOLATION", label: "PPE Violation (Missing Helmet/Vest/Harness)" },
  { value: "FALL", label: "Fall / Slip / Trip" },
  { value: "INJURY", label: "Worker Injury" },
  { value: "EQUIPMENT_ACCIDENT", label: "Heavy Machinery / Equipment Incident" },
  { value: "UNSAFE_BEHAVIOR", label: "Unsafe Work Behavior" },
  { value: "UNSAFE_CONDITION", label: "Hazardous Site Condition" },
  { value: "OTHER", label: "Other Safety Concern" },
];

const SEVERITIES: { value: IncidentSeverity; label: string; badge: string }[] = [
  { value: "LOW", label: "Low (Minor / Near Miss)", badge: "bg-blue-900/40 text-blue-400 border-blue-600/40" },
  { value: "MEDIUM", label: "Medium (Correction Required)", badge: "bg-amber-900/40 text-amber-400 border-amber-600/40" },
  { value: "HIGH", label: "High (Immediate Hazard)", badge: "bg-orange-900/40 text-orange-400 border-orange-600/40 animate-pulse" },
  { value: "CRITICAL", label: "Critical (Severe / Work Stop)", badge: "bg-rose-900/60 text-rose-300 border-rose-500 animate-pulse shadow-lg shadow-rose-900/50 font-extrabold" },
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center space-x-2 text-xs text-slate-400">
        <Link href="/projects" className="hover:text-white">
          Projects
        </Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-white">
          {project?.name || `Project #${projectId}`}
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">Safety Incidents</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>⚠️ Safety Incidents & Violations</span>
            <span className="text-xs bg-rose-600/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
              {incidents.length} Records
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Log, track, and mitigate hazardous conditions, PPE violations, and accidents
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-rose-600/30 self-start sm:self-auto flex items-center space-x-2"
        >
          <span>+ Log Safety Incident</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 text-sm rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl mb-8 space-y-6"
        >
          <h3 className="text-lg font-bold text-white">Record Safety Incident / Hazard</h3>
          {formError && (
            <div className="p-3 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Incident Date *
              </label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Construction Site *
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => {
                  setSelectedSiteId(Number(e.target.value));
                  setSelectedAreaId("");
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Specific Area (Optional)
              </label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Overall Site</option>
                {currentSite?.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.area_type || "Zone"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Reported By *
              </label>
              <select
                value={reportedBy}
                onChange={(e) => setReportedBy(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Incident Type *
              </label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Severity Level *
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Initial Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="OPEN">Open</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Incident Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What happened? Describe the violation, location, and individuals or equipment involved..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Immediate Action Taken / Corrective Measures
            </label>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={2}
              placeholder="e.g. Work stopped immediately, replacement harness issued, warning logged"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {submitting ? "Logging..." : "Log Incident"}
            </button>
          </div>
        </form>
      )}

      {/* Incident List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-3xl mb-2">🛡️</div>
          <h3 className="text-base font-bold text-white mb-1">No Safety Incidents Recorded</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Zero recorded violations for this project. Keep maintaining active safety compliance.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg"
          >
            Log Safety Violation
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map((inc) => {
            const severityObj = SEVERITIES.find((s) => s.value === inc.severity);
            const isHighOrCritical = inc.severity === "HIGH" || inc.severity === "CRITICAL";

            return (
              <div
                key={inc.id}
                className={`bg-slate-900 border rounded-2xl p-6 shadow-xl space-y-4 transition-all ${
                  isHighOrCritical
                    ? "border-rose-700/80 bg-rose-950/10 shadow-rose-950/30"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        severityObj?.badge || "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {inc.severity} SEVERITY
                    </span>
                    <span className="text-sm font-bold text-white">
                      {inc.incident_type.replace("_", " ")}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {inc.site?.name || `Site #${inc.site_id}`}
                      {inc.area && ` · ${inc.area.name}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={inc.status}
                      onChange={(e) => handleStatusChange(inc.id, e.target.value as IncidentStatus)}
                      className={`text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-950 border ${
                        inc.status === "RESOLVED"
                          ? "border-emerald-600/50 text-emerald-400"
                          : inc.status === "UNDER_REVIEW"
                          ? "border-amber-600/50 text-amber-400"
                          : "border-rose-600/50 text-rose-400"
                      }`}
                    >
                      <option value="OPEN">Open</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>

                    <button
                      onClick={() => handleDelete(inc.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete Incident"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-200 leading-relaxed">{inc.description}</p>
                  {inc.action_taken && (
                    <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                      <span className="text-slate-400 font-semibold block mb-0.5">
                        🛠️ Action Taken:
                      </span>
                      <p className="text-slate-300">{inc.action_taken}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>
                    Reported by: {inc.reporter?.name || `User #${inc.reported_by}`}
                  </span>
                  <span>Date: {inc.incident_date}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
