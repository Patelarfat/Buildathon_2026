"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
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
import ProjectNav from "../../../../components/ProjectNav";

const OBSERVATION_TYPES: { value: ObservationType; label: string }[] = [
  { value: "PROGRESS", label: "Progress Tracking" },
  { value: "SAFETY", label: "Safety Issue" },
  { value: "QUALITY", label: "Quality Defect" },
  { value: "MATERIAL", label: "Material Discrepancy" },
  { value: "EQUIPMENT", label: "Equipment Fault / Maintenance" },
  { value: "GENERAL", label: "General Site Note" },
];

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  LOW: "bg-blue-900/30 text-blue-400 border-blue-500/30",
  MEDIUM: "bg-amber-900/30 text-amber-400 border-amber-500/30",
  HIGH: "bg-rose-900/40 text-rose-400 border-rose-600/40 font-bold animate-pulse",
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

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [createdBy, setCreatedBy] = useState<number | "">("");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [observationType, setObservationType] = useState<ObservationType>("SAFETY");
  const [priority, setPriority] = useState<PriorityLevel>("MEDIUM");
  const [status, setStatus] = useState<ObservationStatus>("OPEN");
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 10));
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

  const handleStatusChange = async (obsId: number, newStatus: ObservationStatus) => {
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
        <span className="text-slate-200 font-medium">Observations & Issues</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>👁️ Observations & Issue Log</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {observations.length} Issues Logged
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Structured field observations for tracking recurring bottlenecks, material snags, and assigned fixes
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 self-start sm:self-auto flex items-center space-x-2"
        >
          <span>+ Log Observation / Snag</span>
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
          <h3 className="text-lg font-bold text-white">Log Site Observation / Defect</h3>
          {formError && (
            <div className="p-3 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Observation Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Honeycombing noticed in Column C4, North Wing"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                value={createdBy}
                onChange={(e) => setCreatedBy(Number(e.target.value))}
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

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Assign To (Optional)
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Category / Type *
              </label>
              <select
                value={observationType}
                onChange={(e) => setObservationType(e.target.value as ObservationType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {OBSERVATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Priority Level *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High (Urgent)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Current Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ObservationStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Observed Date
              </label>
              <input
                type="date"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Detailed Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the root issue, dimensions, affected components, and requested remediation..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              required
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {submitting ? "Logging..." : "Log Observation"}
            </button>
          </div>
        </form>
      )}

      {/* Observation List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : observations.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-3xl mb-2">👁️</div>
          <h3 className="text-base font-bold text-white mb-1">No Observations Logged</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Track site defects, quality snags, and maintenance issues for future predictive analysis.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            Log First Observation
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {observations.map((obs) => (
            <div
              key={obs.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full border ${
                      PRIORITY_STYLES[obs.priority] || "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {obs.priority}
                  </span>
                  <span className="text-base font-bold text-white">{obs.title}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-blue-400 border border-slate-700">
                    {obs.observation_type}
                  </span>
                  <span className="text-xs text-slate-400">
                    {obs.site?.name || `Site #${obs.site_id}`}
                    {obs.area && ` · ${obs.area.name}`}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={obs.status}
                    onChange={(e) => handleStatusChange(obs.id, e.target.value as ObservationStatus)}
                    className={`text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-950 border ${
                      obs.status === "RESOLVED"
                        ? "border-emerald-600/50 text-emerald-400"
                        : obs.status === "IN_PROGRESS"
                        ? "border-blue-600/50 text-blue-400"
                        : "border-amber-600/50 text-amber-400"
                    }`}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>

                  <button
                    onClick={() => handleDelete(obs.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    title="Delete Observation"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                {obs.description}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <div className="flex items-center space-x-4">
                  <span>
                    Created by: <strong className="text-slate-300">{obs.creator?.name || `User #${obs.created_by}`}</strong>
                  </span>
                  {obs.assignee && (
                    <span>
                      Assigned to: <strong className="text-blue-400">{obs.assignee.name}</strong>
                    </span>
                  )}
                </div>
                <span>Observed: {obs.observed_at || obs.created_at.slice(0, 10)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
