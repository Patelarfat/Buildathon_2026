"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Plus,
  Trash2,
  Filter,
  FileText,
  Building2,
  UserCheck,
  Calendar,
  ChevronRight,
  Sparkles,
  RefreshCw,
  X,
} from "lucide-react";
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
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";

const INSPECTION_TYPES: { value: InspectionType; label: string }[] = [
  { value: "SAFETY", label: "Safety Audit & Compliance" },
  { value: "QUALITY", label: "Quality Assurance & Workmanship" },
  { value: "EQUIPMENT", label: "Heavy Machinery & Tool Inspection" },
  { value: "ENVIRONMENTAL", label: "Environmental & Waste Compliance" },
  { value: "GENERAL", label: "General Site Walkthrough" },
];

const STATUS_CONFIG: Record<
  InspectionStatus,
  { label: string; badge: string; icon: React.ElementType }
> = {
  OPEN: {
    label: "Open / In Progress",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  PASSED: {
    label: "Passed",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Failed",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
  REQUIRES_ACTION: {
    label: "Requires Action",
    badge: "bg-amber-50 text-amber-800 border-amber-300",
    icon: AlertTriangle,
  },
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Modal / Form State
  const [showForm, setShowForm] = useState(false);
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [inspectorId, setInspectorId] = useState<number | "">("");
  const [inspectionType, setInspectionType] =
    useState<InspectionType>("SAFETY");
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

  const handleStatusChange = async (
    inspectionId: number,
    newStatus: InspectionStatus
  ) => {
    try {
      await updateInspection(inspectionId, { status: newStatus });
      setInspections((prev) =>
        prev.map((i) =>
          i.id === inspectionId ? { ...i, status: newStatus } : i
        )
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const handleDelete = async (inspectionId: number) => {
    if (!confirm("Are you sure you want to delete this inspection record?"))
      return;
    try {
      await deleteInspection(inspectionId);
      setInspections((prev) => prev.filter((i) => i.id !== inspectionId));
    } catch (err: any) {
      alert(err.message || "Failed to delete inspection");
    }
  };

  const currentSite = project?.sites.find(
    (s) => s.id === Number(selectedSiteId)
  );

  // Compute metrics from actual data
  const totalCount = inspections.length;
  const passedCount = inspections.filter((i) => i.status === "PASSED").length;
  const pendingCount = inspections.filter(
    (i) => i.status === "OPEN" || i.status === "REQUIRES_ACTION"
  ).length;
  const failedCount = inspections.filter((i) => i.status === "FAILED").length;

  // Filtered list
  const filteredInspections = inspections.filter((insp) => {
    if (statusFilter === "PASSED" && insp.status !== "PASSED") return false;
    if (
      statusFilter === "PENDING" &&
      insp.status !== "OPEN" &&
      insp.status !== "REQUIRES_ACTION"
    )
      return false;
    if (statusFilter === "FAILED" && insp.status !== "FAILED") return false;

    if (typeFilter !== "ALL" && insp.inspection_type !== typeFilter)
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFindings = insp.findings?.toLowerCase().includes(q);
      const matchRecs = insp.recommendations?.toLowerCase().includes(q);
      const matchSite = insp.site?.name?.toLowerCase().includes(q);
      const matchArea = insp.area?.name?.toLowerCase().includes(q);
      const matchInspector = insp.inspector?.name?.toLowerCase().includes(q);
      const matchType = insp.inspection_type?.toLowerCase().includes(q);
      return (
        matchFindings || matchRecs || matchSite || matchArea || matchInspector || matchType
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
            <span>+ Record Inspection</span>
          </button>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight flex items-center gap-3">
            <span>Site Inspections</span>
            <span className="text-xs bg-[#0B0F10] text-[#F5B82E] font-semibold px-2.5 py-0.5 rounded-full">
              {totalCount} Total
            </span>
          </h1>
          <p className="text-sm sm:text-base text-[#6B7280] font-normal leading-relaxed">
            Conduct and review structural quality, safety audits, and equipment verification.
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
              <span>TOTAL INSPECTIONS</span>
              <FileText className="w-4 h-4 text-[#6B7280]" />
            </div>
            <div className="text-2xl font-bold text-[#171717]">{totalCount}</div>
            <div className="text-[11px] text-[#6B7280]">Registered audit logs</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>PASSED</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900">{passedCount}</div>
            <div className="text-[11px] text-emerald-700/80">Fully compliant</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
              <span>PENDING</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">{pendingCount}</div>
            <div className="text-[11px] text-amber-700/80">Open / Attention required</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
              <span>FAILED</span>
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-900">{failedCount}</div>
            <div className="text-[11px] text-rose-700/80">Requires immediate fix</div>
          </div>
        </div>

        {/* Top Safety / Quality Status Panel */}
        {totalCount > 0 && (
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  failedCount > 0
                    ? "bg-rose-100 text-rose-700"
                    : pendingCount > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {failedCount > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : pendingCount > 0 ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                  INSPECTION STATUS SUMMARY
                </span>
                <p className="text-xs text-[#171717] font-medium mt-0.5">
                  {failedCount > 0
                    ? `${failedCount} inspection(s) failed structural/safety compliance checks.`
                    : pendingCount > 0
                    ? `${pendingCount} inspection(s) are pending review or require remediation.`
                    : "All recorded site inspections are fully verified and up to date."}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-[#6B7280]">
              <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
              <span>Real-time Compliance Sync</span>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search inspections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl pl-9 pr-4 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-[#F6F6F3] p-1 rounded-xl border border-[#E7E5E4] text-xs">
              {[
                { id: "ALL", label: "All" },
                { id: "PENDING", label: "Pending" },
                { id: "PASSED", label: "Passed" },
                { id: "FAILED", label: "Failed" },
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

            {/* Type Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#F5B82E] font-medium"
            >
              <option value="ALL">All Inspection Types</option>
              {INSPECTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#E7E5E4] rounded-2xl h-36 animate-pulse"
              />
            ))}
          </div>
        ) : filteredInspections.length === 0 ? (
          /* Premium Compact White Empty State */
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-8 sm:p-10 text-center max-w-lg mx-auto shadow-sm space-y-4 my-6">
            <div className="w-14 h-14 bg-amber-50 text-[#F5B82E] border border-amber-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <ClipboardCheck className="w-7 h-7 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#171717]">
                {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
                  ? "No matching inspection records"
                  : "No Inspections Yet"}
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed max-w-sm mx-auto">
                {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
                  ? "Try clearing your search query or filters to view inspection logs."
                  : "Start your first site inspection to track quality, safety, and equipment compliance."}
              </p>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                  setShowForm(true);
                }}
                className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Record First Inspection</span>
              </button>

              <span className="text-[11px] text-[#6B7280]">
                Inspection records will appear here once completed.
              </span>
            </div>
          </div>
        ) : (
          /* Inspection Cards List */
          <div className="space-y-4">
            {filteredInspections.map((insp) => {
              const statusCfg =
                STATUS_CONFIG[insp.status] || STATUS_CONFIG.OPEN;
              const StatusIcon = statusCfg.icon;

              return (
                <div
                  key={insp.id}
                  className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-amber-300/50 transition-all space-y-4 group"
                >
                  {/* Card Top Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E7E5E4]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Status Badge */}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center space-x-1.5 ${statusCfg.badge}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusCfg.label}</span>
                      </span>

                      {/* Type */}
                      <h3 className="text-sm font-bold text-[#171717]">
                        {insp.inspection_type} Inspection
                      </h3>

                      {/* Site & Area */}
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-[#F6F6F3] text-[#6B7280] border border-[#E7E5E4] flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-[#6B7280]" />
                        <span>
                          {insp.site?.name || `Site #${insp.site_id}`}
                          {insp.area && ` · ${insp.area.name}`}
                        </span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-3">
                      {/* Quick Status Select */}
                      <select
                        value={insp.status}
                        onChange={(e) =>
                          handleStatusChange(
                            insp.id,
                            e.target.value as InspectionStatus
                          )
                        }
                        className="text-xs font-semibold rounded-xl px-2.5 py-1.5 bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                      >
                        <option value="OPEN">Open</option>
                        <option value="PASSED">Passed</option>
                        <option value="FAILED">Failed</option>
                        <option value="REQUIRES_ACTION">Requires Action</option>
                      </select>

                      <button
                        onClick={() => handleDelete(insp.id)}
                        className="p-1.5 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Inspection Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {insp.findings ? (
                      <div className="bg-[#F6F6F3]/70 p-3.5 rounded-xl border border-[#E7E5E4] space-y-1">
                        <span className="text-[#6B7280] font-semibold flex items-center space-x-1">
                          <FileText className="w-3.5 h-3.5 text-[#6B7280]" />
                          <span>Key Findings & Observations:</span>
                        </span>
                        <p className="text-[#171717] leading-relaxed whitespace-pre-line">
                          {insp.findings}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#F6F6F3]/40 p-3 rounded-xl border border-[#E7E5E4] text-[#6B7280] italic">
                        No specific findings recorded.
                      </div>
                    )}

                    {insp.recommendations ? (
                      <div className="bg-[#F6F6F3]/70 p-3.5 rounded-xl border border-[#E7E5E4] space-y-1">
                        <span className="text-[#6B7280] font-semibold flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#6B7280]" />
                          <span>Recommendations & Remediation:</span>
                        </span>
                        <p className="text-[#171717] leading-relaxed whitespace-pre-line">
                          {insp.recommendations}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#F6F6F3]/40 p-3 rounded-xl border border-[#E7E5E4] text-[#6B7280] italic">
                        No corrective recommendations added.
                      </div>
                    )}
                  </div>

                  {/* Card Footer Metadata */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-[#6B7280] pt-2 border-t border-[#E7E5E4] gap-2">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>
                          Inspector:{" "}
                          <strong className="text-[#171717] font-medium">
                            {insp.inspector?.name ||
                              `User #${insp.inspector_id}`}
                          </strong>
                        </span>
                      </span>

                      <span className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>Date: {insp.inspection_date}</span>
                      </span>
                    </div>

                    <div className="flex items-center text-xs font-semibold text-[#171717] group-hover:text-[#F5B82E] transition-colors cursor-pointer">
                      <span>View Detailed Audit</span>
                      <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Inspection Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F10]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#F5B82E] border border-amber-200 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#171717]">
                    Record Inspection Report
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Log structural quality, safety audit, or equipment inspection findings.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Inspection Date *
                  </label>
                  <input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                    required
                  />
                </div>

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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Inspector *
                  </label>
                  <select
                    value={inspectorId}
                    onChange={(e) => setInspectorId(Number(e.target.value))}
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Inspection Type *
                  </label>
                  <select
                    value={inspectionType}
                    onChange={(e) =>
                      setInspectionType(e.target.value as InspectionType)
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    {INSPECTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Evaluation Result / Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as InspectionStatus)
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    <option value="OPEN">Open / In Progress</option>
                    <option value="PASSED">Passed</option>
                    <option value="FAILED">Failed</option>
                    <option value="REQUIRES_ACTION">Requires Action</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Key Findings & Observations
                </label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={3}
                  placeholder="Detail all observations, compliance notes, and deviations found..."
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Recommendations & Corrective Actions
                </label>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  rows={2}
                  placeholder="Recommended actions or remediations before work continues..."
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
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
                  {submitting ? "Saving..." : "Save Inspection Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
