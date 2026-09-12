"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  getProject,
  getProjectDashboard,
  ProjectDetail,
  Site,
  ManagerDashboardData,
} from "@/lib/api";
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Grid,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Activity as ActivityIcon,
  Brain,
  ShieldAlert,
  ClipboardCheck,
  AlertCircle,
  Package,
  Camera,
  FileText,
  ChevronRight,
  HardHat,
  ShieldCheck,
  Layers,
  SlidersHorizontal,
  Info,
} from "lucide-react";

export default function ManagerDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);

  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | undefined>(undefined);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const loadDashboard = async (
    daysWindow: number = days,
    siteFilter?: number
  ) => {
    try {
      setLoading(true);
      setError(null);
      const [dashData, projData] = await Promise.all([
        getProjectDashboard(projectId, {
          days: daysWindow,
          site_id: siteFilter,
        }),
        getProject(projectId).catch(() => null),
      ]);
      setDashboard(dashData);
      if (projData) {
        setProject(projData);
        if (projData.sites) {
          setSites(projData.sites);
        }
      }
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      setError(err?.message || "Failed to load manager decision center data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadDashboard(days, selectedSiteId);
    }
  }, [projectId, days, selectedSiteId]);

  // Priority Pill Colors
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return {
          bg: "bg-rose-50 border-rose-200 text-rose-800",
          badge: "bg-rose-600 text-white font-bold",
          borderLeft: "border-l-4 border-l-rose-600",
          btn: "bg-rose-600 hover:bg-rose-700 text-white",
        };
      case "HIGH":
        return {
          bg: "bg-amber-50 border-amber-200 text-amber-900",
          badge: "bg-amber-600 text-white font-bold",
          borderLeft: "border-l-4 border-l-amber-500",
          btn: "bg-amber-600 hover:bg-amber-700 text-white",
        };
      case "MEDIUM":
        return {
          bg: "bg-slate-50 border-slate-200 text-slate-800",
          badge: "bg-slate-700 text-white font-semibold",
          borderLeft: "border-l-4 border-l-slate-400",
          btn: "bg-slate-900 hover:bg-slate-800 text-white",
        };
      default:
        return {
          bg: "bg-slate-50 border-slate-200 text-slate-700",
          badge: "bg-slate-600 text-white",
          borderLeft: "border-l-4 border-l-slate-300",
          btn: "bg-slate-800 hover:bg-slate-700 text-white",
        };
    }
  };

  // Status Indicator Styles
  const getRiskStatusBadge = (level: string) => {
    switch (level) {
      case "CRITICAL":
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            {level}
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            LOW / STABLE
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#171717]">
      {/* Shared Project Context Header & Stationary Navigation */}
      <ProjectHeader
        projectId={projectId}
        projectName={project?.name || dashboard?.project.name}
        status={project?.status || dashboard?.project.status}
        location={project?.location || dashboard?.project.location}
        siteCount={dashboard?.project.site_count ?? project?.sites?.length ?? 0}
        areaCount={dashboard?.project.area_count ?? 0}
        startDate={project?.start_date}
        endDate={project?.end_date}
        actions={
          <div className="flex flex-wrap items-center gap-3 bg-white p-1.5 rounded-xl border border-[#E7E5E4] shadow-xs">
            {/* Site Selector */}
            <div className="flex items-center gap-2 px-2 py-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Site:</span>
              <select
                value={selectedSiteId || ""}
                onChange={(e) =>
                  setSelectedSiteId(e.target.value ? Number(e.target.value) : undefined)
                }
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#F5B82E]"
              >
                <option value="">All Sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Window Selector */}
            <div className="flex items-center gap-1 border-l border-[#E7E5E4] pl-3 py-1">
              {[
                { label: "24h", val: 1 },
                { label: "7d", val: 7 },
                { label: "30d", val: 30 },
              ].map((t) => (
                <button
                  key={t.val}
                  onClick={() => setDays(t.val)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    days === t.val
                      ? "bg-[#0B0F14] text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Refresh Action */}
            <button
              onClick={() => loadDashboard(days, selectedSiteId)}
              title="Refresh latest project intelligence"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border-l border-[#E7E5E4] pl-3"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">

        {/* 2. PAGE TITLE & SUBTITLE */}
        <div className="space-y-1.5">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Manager Dashboard
          </h2>
          <p className="text-sm sm:text-base text-slate-500 font-normal leading-relaxed">
            Operational overview of project health, safety and field activity.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {loading && !dashboard ? (
          <div className="bg-white border border-[#E4E7EC] rounded-2xl p-16 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#F5B82E] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">
              Fetching operational command center intelligence...
            </p>
          </div>
        ) : dashboard ? (
          <>
            {/* Data Confidence Banner if Low */}
            {dashboard.executive_health.data_confidence === "LOW" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Limited Data Available:</strong> Few field safety records logged for the selected time window. Lack of records does not confirm complete site safety.
                  </span>
                </div>
                <Link
                  href={`/projects/${projectId}/observations`}
                  className="font-bold text-amber-900 underline hover:text-amber-950 shrink-0"
                >
                  Log Observation →
                </Link>
              </div>
            )}

            {/* 3. EXECUTIVE METRICS STRIP (5 Compact Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Card 1: Project Risk */}
              <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Project Risk
                  </span>
                  {getRiskStatusBadge(dashboard.executive_health.risk_level)}
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {dashboard.executive_health.risk_score}
                    <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    Trend: <strong className="text-slate-800">{dashboard.executive_health.risk_trend}</strong>
                  </div>
                </div>
              </div>

              {/* Card 2: Progress */}
              <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Progress
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {dashboard.executive_health.progress_trend}
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {dashboard.executive_health.progress_pct !== null
                      ? `${dashboard.executive_health.progress_pct}%`
                      : "N/A"}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Workers: <strong className="text-slate-800">{dashboard.progress.latest_workers ?? "N/A"}</strong> on site
                  </div>
                </div>
              </div>

              {/* Card 3: Open Safety Issues */}
              <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Open Safety Issues
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Active
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {dashboard.executive_health.open_safety_issues}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {dashboard.safety.ai_findings_open} AI + {dashboard.safety.human_incidents_open} Incidents
                  </div>
                </div>
              </div>

              {/* Card 4: Observations */}
              <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Observations
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Field Logs
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {dashboard.executive_health.open_observations}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {dashboard.safety.observations_total} Total field logs
                  </div>
                </div>
              </div>

              {/* Card 5: Ops Blockers */}
              <div className="bg-white border border-[#E4E7EC] p-4 rounded-xl shadow-xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Ops Blockers
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    Supply / Ops
                  </span>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {dashboard.executive_health.operational_blockers}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {dashboard.materials.low_stock_materials.length} Low stock + {dashboard.materials.open_blockers.length} Blockers
                  </div>
                </div>
              </div>
            </div>

            {/* 4. "WHAT NEEDS ATTENTION" Panel */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                    WHAT NEEDS ATTENTION
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {dashboard.attention_items.length} Actionable Alert(s)
                </span>
              </div>

              {dashboard.attention_items.length === 0 ? (
                <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200/60 flex items-center gap-3 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No critical alerts or urgent safety blockers detected for this time window.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboard.attention_items.map((item, idx) => {
                    const style = getPriorityStyle(item.priority);
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${style.borderLeft} ${style.bg}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              {item.title}
                            </span>
                            <span
                              className={`text-[10px] uppercase px-2 py-0.5 rounded ${style.badge}`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                          <span className="text-[11px] font-mono text-slate-500 uppercase">
                            {item.category.replace(/_/g, " ")}
                          </span>
                          <Link
                            href={item.action_url}
                            className={`text-xs font-semibold px-3 py-1 rounded-md transition ${style.btn}`}
                          >
                            {item.action_label} →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 5. OPERATIONAL OVERVIEW (2-Column Grid: Safety & Risk vs Field Operations) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* LEFT: SAFETY & RISK */}
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      SAFETY & RISK HEALTH
                    </h3>
                  </div>
                  {getRiskStatusBadge(dashboard.executive_health.risk_level)}
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Risk Score</span>
                    <div className="text-3xl font-black text-slate-900 mt-0.5">
                      {dashboard.executive_health.risk_score}
                      <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Risk Trend</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 inline-block">
                      {dashboard.executive_health.risk_trend}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-900 block">Status Summary:</span>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {dashboard.risk.reasons && dashboard.risk.reasons.length > 0
                      ? dashboard.risk.reasons[0]
                      : "No active safety hazards or severe incidents recorded for the selected window."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">AI Findings Open</span>
                    <span className="text-base font-bold text-slate-900 mt-0.5 block">
                      {dashboard.safety.ai_findings_open}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Human Incidents</span>
                    <span className="text-base font-bold text-slate-900 mt-0.5 block">
                      {dashboard.safety.human_incidents_open}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT: FIELD OPERATIONS */}
              <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                  <div className="flex items-center space-x-2">
                    <ActivityIcon className="w-4 h-4 text-[#D99A16]" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      FIELD OPERATIONS ACTIVITY
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">Live operational modules</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {[
                    {
                      label: "Site Photos",
                      count: dashboard.safety.ai_findings_total || 0,
                      href: `/projects/${projectId}/photos`,
                      icon: Camera,
                    },
                    {
                      label: "Daily Reports",
                      count: dashboard.progress.total_reports || 0,
                      href: `/projects/${projectId}/daily-reports`,
                      icon: FileText,
                    },
                    {
                      label: "Safety Incidents",
                      count: dashboard.safety.human_incidents_total || 0,
                      href: `/projects/${projectId}/incidents`,
                      icon: ShieldAlert,
                    },
                    {
                      label: "Inspections",
                      count: dashboard.safety.inspections_total || 0,
                      href: `/projects/${projectId}/inspections`,
                      icon: ClipboardCheck,
                    },
                    {
                      label: "Observations",
                      count: dashboard.safety.observations_total || 0,
                      href: `/projects/${projectId}/observations`,
                      icon: AlertCircle,
                    },
                    {
                      label: "Materials",
                      count: (dashboard.materials.low_stock_materials?.length || 0) + (dashboard.materials.delayed_materials?.length || 0),
                      href: `/projects/${projectId}/materials`,
                      icon: Package,
                    },
                  ].map((row) => {
                    const RowIcon = row.icon;
                    return (
                      <Link
                        key={row.label}
                        href={row.href}
                        className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-[#F5B82E] group-hover:text-[#0B0F14] transition-colors">
                            <RowIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-900">
                            {row.label}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {row.count}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 6. HIGHEST-RISK AREAS & RISK EXPLANATION (2-Column Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* AREA RISK RANKING TABLE */}
              <div className="lg:col-span-7 bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      HIGHEST-RISK AREAS
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ranked zones sorted by safety risk score descending.
                    </p>
                  </div>
                  <Link
                    href={`/projects/${projectId}`}
                    className="text-xs text-[#D99A16] hover:underline font-bold"
                  >
                    View Structure →
                  </Link>
                </div>

                {dashboard.area_risk.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">
                    No areas configured yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-[#E4E7EC]">
                        <tr>
                          <th className="py-2.5 px-3">Area</th>
                          <th className="py-2.5 px-3">Risk Score</th>
                          <th className="py-2.5 px-3">Level</th>
                          <th className="py-2.5 px-3">AI Findings</th>
                          <th className="py-2.5 px-3">Incidents</th>
                          <th className="py-2.5 px-3">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dashboard.area_risk.slice(0, 5).map((area, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <span className="text-slate-400 mr-1.5">#{idx + 1}</span>
                              {area.area_name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 mr-1">
                                {area.risk_score}
                              </span>
                              <span className="text-[10px] text-slate-400">/ 100</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {getRiskStatusBadge(area.risk_level)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {area.ai_findings_count}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-rose-600">
                              {area.incidents_count}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              {area.trend === "INCREASING" ? (
                                <span className="text-rose-600">↑ Increasing</span>
                              ) : area.trend === "DECREASING" ? (
                                <span className="text-emerald-600">↓ Decreasing</span>
                              ) : (
                                "→ Stable"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* RISK EXPLANABILITY PANEL */}
              <div className="lg:col-span-5 bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                      WHY THIS RISK SCORE?
                    </h3>
                    <span className="text-xs font-extrabold text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-md">
                      {dashboard.risk.score} / 100
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Deterministic risk factors evaluated from live field records:
                  </p>

                  <div className="space-y-2">
                    {dashboard.risk.reasons && dashboard.risk.reasons.length > 0 ? (
                      dashboard.risk.reasons.slice(0, 4).map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F5B82E] shrink-0 mt-1.5" />
                          <span>{r}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center italic">
                        No active safety hazards recorded for this window.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
                  Note: {dashboard.risk.disclaimer}
                </div>
              </div>
            </div>

            {/* 7. CONSTRUCTION INTELLIGENCE & PPE BREAKDOWN */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E4E7EC]">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[#D99A16]" />
                    <span>CONSTRUCTION INTELLIGENCE</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    AI-powered operational insights from project site activity.
                  </p>
                </div>
                <Link
                  href={`/projects/${projectId}/intelligence`}
                  className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-[#0B0F14] bg-[#F5B82E] hover:bg-[#e0a727] rounded-lg transition-colors shadow-xs"
                >
                  Open Intelligence →
                </Link>
              </div>

              {/* PPE Computer Vision Breakdown */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  AI Computer Vision Safety Analysis
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <HardHat className="w-5 h-5 text-slate-600 mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-slate-900">
                      {dashboard.safety.ppe_breakdown.no_helmet}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Missing Helmet</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <ShieldAlert className="w-5 h-5 text-slate-600 mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-slate-900">
                      {dashboard.safety.ppe_breakdown.no_gloves}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Missing Gloves</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <Layers className="w-5 h-5 text-slate-600 mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-slate-900">
                      {dashboard.safety.ppe_breakdown.no_boots}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Missing Boots</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-slate-600 mx-auto mb-1.5" />
                    <div className="text-xl font-bold text-slate-900">
                      {dashboard.safety.ppe_breakdown.no_goggles}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">Missing Goggles</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 8. LIVE FIELD ACTIVITY STREAM */}
            <div className="bg-white border border-[#E4E7EC] rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <ActivityIcon className="w-4 h-4 text-[#D99A16]" />
                  <span>LIVE FIELD ACTIVITY FEED</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Latest {dashboard.recent_activity.length} Events
                </span>
              </div>

              {dashboard.recent_activity.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 italic">
                  No field activity logged yet.
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 divide-y divide-slate-100">
                  {dashboard.recent_activity.map((act, index) => (
                    <div
                      key={`${act.id}-${index}`}
                      className="pt-3 first:pt-0 flex items-start gap-3 text-xs"
                    >
                      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 mt-0.5">
                        {act.type === "INCIDENT" && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                        {act.type === "PHOTO" && <Camera className="w-3.5 h-3.5 text-slate-600" />}
                        {act.type === "REPORT" && <FileText className="w-3.5 h-3.5 text-slate-600" />}
                        {act.type === "INSPECTION" && <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />}
                        {act.type === "MATERIAL" && <Package className="w-3.5 h-3.5 text-slate-600" />}
                        {act.type === "OBSERVATION" && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                      </div>

                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {act.title}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {act.date}
                          </span>
                        </div>
                        {act.description && (
                          <p className="text-slate-500 text-[11px] line-clamp-1">
                            {act.description}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-0.5">
                          {act.user_name && <span>By {act.user_name}</span>}
                          {act.area_name && <span>• Area: {act.area_name}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
