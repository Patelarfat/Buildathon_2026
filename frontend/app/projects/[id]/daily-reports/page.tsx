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
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Building2,
  Grid,
  Calendar,
  Users,
  CloudSun,
  Wrench,
  Package,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  TrendingUp,
} from "lucide-react";

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

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "blockers">("all");

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

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      searchQuery === "" ||
      r.report_date.includes(searchQuery) ||
      r.work_completed?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.site?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterTab === "blockers") {
      return matchesSearch && (r.issues || r.blockers);
    }
    return matchesSearch;
  });

  const latestReport = reports.length > 0 ? reports[0] : null;

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
            <span>{showForm ? "Close Form" : "New Daily Report"}</span>
          </button>
        }
      />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight">
            Daily Site Reports
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-normal leading-relaxed">
            Track daily progress, manpower, equipment, conditions and site impediments.
          </p>
        </div>

        {/* 2. REPORT SUMMARY STRIP */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E7E5E4] p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Total Reports</span>
              <div className="text-3xl font-black text-[#171717] mt-1">{reports.length}</div>
            </div>
            <FileText className="w-6 h-6 text-slate-400" />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-4 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Latest Report</span>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {latestReport ? latestReport.report_date : "—"}
              </div>
            </div>
            <Calendar className="w-5 h-5 text-[#D99A16]" />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-4 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Reporting Status</span>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                {reports.length > 0 ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active Logging
                  </>
                ) : (
                  <span className="text-slate-400 font-medium">No reports yet</span>
                )}
              </div>
            </div>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* 3. REPORT TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-xl border border-[#E7E5E4] shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by date, site or keyword..."
              className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#171717] placeholder-slate-400 focus:outline-none focus:border-[#F5B82E]"
            />
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                filterTab === "all"
                  ? "bg-[#171717] text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              All Reports ({reports.length})
            </button>
            <button
              onClick={() => setFilterTab("blockers")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                filterTab === "blockers"
                  ? "bg-[#171717] text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              With Impediments
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* 4. SUBMIT DAILY REPORT FORM MODAL */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
              <h3 className="text-base font-bold text-[#171717] tracking-tight">Submit Shift Daily Report</h3>
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
                  Report Date *
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
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
                  Estimated Progress % (0–100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={progressPercentage}
                  onChange={(e) => setProgressPercentage(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 45"
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  On-Site Workers Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={workersCount}
                  onChange={(e) => setWorkersCount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 32"
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Weather Conditions
                </label>
                <input
                  type="text"
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  placeholder="e.g. Sunny, 30°C / Rain"
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Work Completed Today
                </label>
                <textarea
                  value={workCompleted}
                  onChange={(e) => setWorkCompleted(e.target.value)}
                  rows={3}
                  placeholder="Details on tasks and milestones completed today..."
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Work Planned Next Shift
                </label>
                <textarea
                  value={workPlanned}
                  onChange={(e) => setWorkPlanned(e.target.value)}
                  rows={3}
                  placeholder="Tasks scheduled for the upcoming shift..."
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Equipment Deployed
                </label>
                <input
                  type="text"
                  value={equipmentUsed}
                  onChange={(e) => setEquipmentUsed(e.target.value)}
                  placeholder="e.g. 2x JCB Excavator, 1x Tower Crane"
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Materials Consumed
                </label>
                <input
                  type="text"
                  value={materialsUsed}
                  onChange={(e) => setMaterialsUsed(e.target.value)}
                  placeholder="e.g. 120 bags cement, 3 tons rebar"
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Issues / Delays
                </label>
                <textarea
                  value={issues}
                  onChange={(e) => setIssues(e.target.value)}
                  rows={2}
                  placeholder="Minor or major site issues..."
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Blockers / Stoppages
                </label>
                <textarea
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  rows={2}
                  placeholder="Critical blockers halting work..."
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="General shift logs and notes..."
                  className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                />
              </div>
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
                {submitting ? "Submitting..." : "Save Daily Report"}
              </button>
            </div>
          </form>
        )}

        {/* 5. REPORTS FEED OR EMPTY STATE */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E7E5E4] rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white border border-dashed border-[#E7E5E4] rounded-2xl p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#171717]">No Daily Reports Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create your first site report to start building a clear operational history.
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="px-4.5 py-2 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-xs font-bold rounded-xl transition-colors shadow-xs inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Daily Report</span>
            </button>
            <p className="text-[11px] text-slate-400 block pt-1">
              Reports capture progress, manpower, equipment, weather and site impediments.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReports.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-4 hover:shadow-md transition-all duration-200"
              >
                {/* Card Header & Date Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
                  <div className="flex items-center space-x-3">
                    <div className="pl-3 border-l-3 border-l-[#F5B82E]">
                      <span className="text-sm font-extrabold text-[#171717]">
                        {r.report_date}
                      </span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {r.site?.name || `Site #${r.site_id}`}
                      {r.area && ` · ${r.area.name}`}
                    </span>
                    {r.progress_percentage !== null && r.progress_percentage !== undefined && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {r.progress_percentage}% Progress
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-500">
                    <span>By {r.reporter?.name || `User #${r.reported_by}`}</span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2-Column Work Description */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {r.work_completed && (
                    <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E7E5E4] space-y-1">
                      <span className="text-xs font-bold text-slate-900 block">Work Completed:</span>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{r.work_completed}</p>
                    </div>
                  )}
                  {r.work_planned && (
                    <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E7E5E4] space-y-1">
                      <span className="text-xs font-bold text-slate-900 block">Work Planned Next:</span>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-line">{r.work_planned}</p>
                    </div>
                  )}
                </div>

                {/* Operations Sub-metrics */}
                <div className="flex flex-wrap gap-5 text-xs text-slate-600 pt-1">
                  {r.workers_count !== null && (
                    <div className="flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Workers: <strong className="text-[#171717]">{r.workers_count}</strong></span>
                    </div>
                  )}
                  {r.weather && (
                    <div className="flex items-center space-x-1.5">
                      <CloudSun className="w-3.5 h-3.5 text-slate-400" />
                      <span>Weather: <strong className="text-[#171717]">{r.weather}</strong></span>
                    </div>
                  )}
                  {r.equipment_used && (
                    <div className="flex items-center space-x-1.5">
                      <Wrench className="w-3.5 h-3.5 text-slate-400" />
                      <span>Equipment: <strong className="text-[#171717]">{r.equipment_used}</strong></span>
                    </div>
                  )}
                  {r.materials_used && (
                    <div className="flex items-center space-x-1.5">
                      <Package className="w-3.5 h-3.5 text-slate-400" />
                      <span>Materials: <strong className="text-[#171717]">{r.materials_used}</strong></span>
                    </div>
                  )}
                </div>

                {/* Issues & Blockers Banner */}
                {(r.issues || r.blockers) && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1 text-rose-900 font-medium">
                    {r.issues && (
                      <p>
                        <strong className="text-rose-700">Issues:</strong> {r.issues}
                      </p>
                    )}
                    {r.blockers && (
                      <p>
                        <strong className="text-rose-700">Blockers:</strong> {r.blockers}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
