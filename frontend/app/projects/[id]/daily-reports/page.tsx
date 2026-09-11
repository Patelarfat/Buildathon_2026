"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  DailyReport,
  ProjectDetail,
  User,
  getProject,
  getDailyReports,
  createDailyReport,
  deleteDailyReport,
  getUsers,
} from "../../../../lib/api";
import ProjectNav from "../../../../components/ProjectNav";

export default function DailyReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [reportedBy, setReportedBy] = useState<number | "">("");
  const [workCompleted, setWorkCompleted] = useState("");
  const [workPlanned, setWorkPlanned] = useState("");
  const [progressPercentage, setProgressPercentage] = useState<number | "">("");
  const [workersCount, setWorkersCount] = useState<number | "">("");
  const [weather, setWeather] = useState("Clear / Sunny, 28°C");
  const [equipmentUsed, setEquipmentUsed] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [issues, setIssues] = useState("");
  const [blockers, setBlockers] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, reportsData, usersData] = await Promise.all([
        getProject(projectId),
        getDailyReports(projectId),
        getUsers(),
      ]);
      setProject(projData);
      setReports(reportsData);
      setUsers(usersData);

      if (projData.sites.length > 0 && selectedSiteId === "") {
        setSelectedSiteId(projData.sites[0].id);
      }
      if (usersData.length > 0 && reportedBy === "") {
        setReportedBy(usersData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load daily reports");
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
    if (!reportDate) {
      setFormError("Report Date is required");
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
      await createDailyReport({
        project_id: projectId,
        site_id: Number(selectedSiteId),
        area_id: selectedAreaId ? Number(selectedAreaId) : undefined,
        reported_by: Number(reportedBy),
        report_date: reportDate,
        work_completed: workCompleted.trim() || undefined,
        work_planned: workPlanned.trim() || undefined,
        progress_percentage: progressPercentage !== "" ? Number(progressPercentage) : undefined,
        workers_count: workersCount !== "" ? Number(workersCount) : undefined,
        weather: weather.trim() || undefined,
        equipment_used: equipmentUsed.trim() || undefined,
        materials_used: materialsUsed.trim() || undefined,
        issues: issues.trim() || undefined,
        blockers: blockers.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setShowForm(false);
      setWorkCompleted("");
      setWorkPlanned("");
      setProgressPercentage("");
      setWorkersCount("");
      setEquipmentUsed("");
      setMaterialsUsed("");
      setIssues("");
      setBlockers("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to submit daily report");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reportId: number) => {
    if (!confirm("Are you sure you want to delete this daily report?")) return;
    try {
      await deleteDailyReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err: any) {
      alert(err.message || "Failed to delete report");
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
        <span className="text-slate-200 font-medium">Daily Site Reports</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>📋 Daily Site Reports</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {reports.length} Reports
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Log shift completions, labor counts, equipment, weather, and daily impediments
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 self-start sm:self-auto"
        >
          {showForm ? "Close Form" : "+ File Daily Report"}
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
          <h3 className="text-lg font-bold text-white">Submit Shift Daily Report</h3>
          {formError && (
            <div className="p-3 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Report Date *
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
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
                Estimated Progress % (0–100)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={progressPercentage}
                onChange={(e) => setProgressPercentage(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 45"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                On-Site Workers Count
              </label>
              <input
                type="number"
                min="0"
                value={workersCount}
                onChange={(e) => setWorkersCount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 32"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Weather Conditions
              </label>
              <input
                type="text"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="e.g. Sunny, 30°C / Rain"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Work Completed Today
              </label>
              <textarea
                value={workCompleted}
                onChange={(e) => setWorkCompleted(e.target.value)}
                rows={3}
                placeholder="Details on tasks and milestones completed today..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Work Planned Next Shift
              </label>
              <textarea
                value={workPlanned}
                onChange={(e) => setWorkPlanned(e.target.value)}
                rows={3}
                placeholder="Tasks scheduled for the upcoming shift..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Equipment Deployed
              </label>
              <input
                type="text"
                value={equipmentUsed}
                onChange={(e) => setEquipmentUsed(e.target.value)}
                placeholder="e.g. 2x JCB Excavator, 1x Tower Crane, Concrete Mixer"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Materials Consumed
              </label>
              <input
                type="text"
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                placeholder="e.g. 120 bags cement, 3 tons rebar"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Issues / Delays
              </label>
              <textarea
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                rows={2}
                placeholder="Any minor or major site issues..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Blockers / Stoppages
              </label>
              <textarea
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                rows={2}
                placeholder="Critical blockers halting work..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Additional Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="General shift logs and notes..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
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
              {submitting ? "Submitting..." : "Save Daily Report"}
            </button>
          </div>
        </form>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-40 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-3xl mb-2">📋</div>
          <h3 className="text-base font-bold text-white mb-1">No Daily Reports Logged</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Daily logs provide historical tracking of progress, manpower, and site blockers.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            File First Daily Report
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-white">📅 {r.report_date}</span>
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {r.site?.name || `Site #${r.site_id}`}
                    {r.area && ` · ${r.area.name}`}
                  </span>
                  {r.progress_percentage !== null && r.progress_percentage !== undefined && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                      {r.progress_percentage}% Progress
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">
                    By {r.reporter?.name || `User #${r.reported_by}`}
                  </span>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                    title="Delete Report"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {r.work_completed && (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">✅ Work Completed:</span>
                    <p className="text-slate-200 whitespace-pre-line">{r.work_completed}</p>
                  </div>
                )}
                {r.work_planned && (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-semibold block mb-1">🎯 Work Planned Next:</span>
                    <p className="text-slate-200 whitespace-pre-line">{r.work_planned}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1">
                {r.workers_count !== null && (
                  <div>
                    <span className="text-slate-500">👷 Workers:</span>{" "}
                    <span className="text-slate-200 font-medium">{r.workers_count}</span>
                  </div>
                )}
                {r.weather && (
                  <div>
                    <span className="text-slate-500">⛅ Weather:</span>{" "}
                    <span className="text-slate-200 font-medium">{r.weather}</span>
                  </div>
                )}
                {r.equipment_used && (
                  <div>
                    <span className="text-slate-500">🚜 Equipment:</span>{" "}
                    <span className="text-slate-200 font-medium">{r.equipment_used}</span>
                  </div>
                )}
                {r.materials_used && (
                  <div>
                    <span className="text-slate-500">🧱 Materials:</span>{" "}
                    <span className="text-slate-200 font-medium">{r.materials_used}</span>
                  </div>
                )}
              </div>

              {(r.issues || r.blockers) && (
                <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl text-xs space-y-1">
                  {r.issues && (
                    <p className="text-rose-300">
                      <span className="font-semibold text-rose-400">⚠️ Issues:</span> {r.issues}
                    </p>
                  )}
                  {r.blockers && (
                    <p className="text-rose-300">
                      <span className="font-semibold text-rose-400">🛑 Blockers:</span> {r.blockers}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
