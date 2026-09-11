"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  InspectionReport,
  InspectionType,
  InspectionStatus,
  ProjectDetail,
  User,
  getProject,
  getInspections,
  createInspection,
  updateInspection,
  deleteInspection,
  getUsers,
} from "../../../../lib/api";
import ProjectNav from "../../../../components/ProjectNav";

const INSPECTION_TYPES: { value: InspectionType; label: string }[] = [
  { value: "SAFETY", label: "Safety Audit & Compliance" },
  { value: "QUALITY", label: "Quality Assurance & Workmanship" },
  { value: "EQUIPMENT", label: "Heavy Machinery & Tool Inspection" },
  { value: "ENVIRONMENTAL", label: "Environmental & Waste Compliance" },
  { value: "GENERAL", label: "General Site Walkthrough" },
];

const STATUS_CONFIG: Record<InspectionStatus, { label: string; badge: string }> = {
  OPEN: { label: "Open / In Progress", badge: "bg-blue-900/30 text-blue-400 border-blue-500/30" },
  PASSED: { label: "Passed", badge: "bg-emerald-900/30 text-emerald-400 border-emerald-500/30 font-semibold" },
  FAILED: { label: "Failed", badge: "bg-rose-900/40 text-rose-400 border-rose-600/40 font-bold" },
  REQUIRES_ACTION: { label: "Requires Action", badge: "bg-amber-900/40 text-amber-400 border-amber-600/40 font-semibold" },
};

export default function InspectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [inspections, setInspections] = useState<InspectionReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [inspectorId, setInspectorId] = useState<number | "">("");
  const [inspectionType, setInspectionType] = useState<InspectionType>("SAFETY");
  const [status, setStatus] = useState<InspectionStatus>("OPEN");
  const [findings, setFindings] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, inspectionsData, usersData] = await Promise.all([
        getProject(projectId),
        getInspections(projectId),
        getUsers(),
      ]);
      setProject(projData);
      setInspections(inspectionsData);
      setUsers(usersData);

      if (projData.sites.length > 0 && selectedSiteId === "") {
        setSelectedSiteId(projData.sites[0].id);
      }
      if (usersData.length > 0 && inspectorId === "") {
        setInspectorId(usersData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load inspections");
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
    if (!selectedSiteId) {
      setFormError("Please select a construction site");
      return;
    }
    if (!inspectorId) {
      setFormError("Please select the inspector");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await createInspection({
        project_id: projectId,
        site_id: Number(selectedSiteId),
        area_id: selectedAreaId ? Number(selectedAreaId) : undefined,
        inspector_id: Number(inspectorId),
        inspection_date: inspectionDate,
        inspection_type: inspectionType,
        status,
        findings: findings.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setShowForm(false);
      setFindings("");
      setRecommendations("");
      setNotes("");
      setStatus("OPEN");
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to record inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (inspectionId: number, newStatus: InspectionStatus) => {
    try {
      await updateInspection(inspectionId, { status: newStatus });
      setInspections((prev) =>
        prev.map((i) => (i.id === inspectionId ? { ...i, status: newStatus } : i))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (inspectionId: number) => {
    if (!confirm("Are you sure you want to delete this inspection record?")) return;
    try {
      await deleteInspection(inspectionId);
      setInspections((prev) => prev.filter((i) => i.id !== inspectionId));
    } catch (err: any) {
      alert(err.message || "Failed to delete inspection");
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
        <span className="text-slate-200 font-medium">Site Inspections</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>🔍 Quality & Safety Inspections</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {inspections.length} Reports
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Conduct and review structural quality, safety audits, and equipment verification checklists
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 self-start sm:self-auto flex items-center space-x-2"
        >
          <span>+ Record Inspection</span>
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
          <h3 className="text-lg font-bold text-white">Record Inspection Report</h3>
          {formError && (
            <div className="p-3 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Inspection Date *
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
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
                Inspector *
              </label>
              <select
                value={inspectorId}
                onChange={(e) => setInspectorId(Number(e.target.value))}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Inspection Type *
              </label>
              <select
                value={inspectionType}
                onChange={(e) => setInspectionType(e.target.value as InspectionType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {INSPECTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Evaluation Result / Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InspectionStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="OPEN">Open / In Progress</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
                <option value="REQUIRES_ACTION">Requires Action</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Key Findings & Observations
            </label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={3}
              placeholder="Detail all observations, compliance notes, and deviations found..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Recommendations & Corrective Actions
            </label>
            <textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={2}
              placeholder="Recommended actions or remediations before work continues..."
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {submitting ? "Saving..." : "Save Inspection"}
            </button>
          </div>
        </form>
      )}

      {/* Inspections List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : inspections.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-3xl mb-2">📋</div>
          <h3 className="text-base font-bold text-white mb-1">No Inspections Conducted</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Conduct safety audits, quality verifications, and structural inspections for this site.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            Conduct First Inspection
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {inspections.map((insp) => {
            const statusConfig = STATUS_CONFIG[insp.status] || {
              label: insp.status,
              badge: "bg-slate-800 text-slate-300",
            };

            return (
              <div
                key={insp.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border ${statusConfig.badge}`}
                    >
                      {statusConfig.label}
                    </span>
                    <span className="text-sm font-bold text-white">
                      {insp.inspection_type} Inspection
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {insp.site?.name || `Site #${insp.site_id}`}
                      {insp.area && ` · ${insp.area.name}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={insp.status}
                      onChange={(e) => handleStatusChange(insp.id, e.target.value as InspectionStatus)}
                      className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-950 border border-slate-700 text-white focus:outline-none"
                    >
                      <option value="OPEN">Open</option>
                      <option value="PASSED">Passed</option>
                      <option value="FAILED">Failed</option>
                      <option value="REQUIRES_ACTION">Requires Action</option>
                    </select>

                    <button
                      onClick={() => handleDelete(insp.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete Inspection"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {insp.findings && (
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-semibold block mb-1">🔍 Findings:</span>
                      <p className="text-slate-200 whitespace-pre-line">{insp.findings}</p>
                    </div>
                  )}
                  {insp.recommendations && (
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-semibold block mb-1">💡 Recommendations:</span>
                      <p className="text-slate-200 whitespace-pre-line">{insp.recommendations}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>
                    Inspector: {insp.inspector?.name || `User #${insp.inspector_id}`}
                  </span>
                  <span>Date: {insp.inspection_date}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
