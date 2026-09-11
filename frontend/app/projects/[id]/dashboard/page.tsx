"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  getProject,
  getProjectDashboard,
  Project,
  ProjectDetail,
  Site,
  ManagerDashboardData,
  AttentionItem,
} from "@/lib/api";
import ProjectNav from "@/components/ProjectNav";

export default function ManagerDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);

  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
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
      if (projData && projData.sites) {
        setSites(projData.sites);
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

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return {
          bg: "bg-red-500/10 border-red-500/40 text-red-300",
          badge: "bg-red-600 text-white font-bold",
          borderLeft: "border-l-4 border-l-red-500",
          btn: "bg-red-600 hover:bg-red-500 text-white",
        };
      case "HIGH":
        return {
          bg: "bg-orange-500/10 border-orange-500/40 text-orange-300",
          badge: "bg-orange-600 text-white font-bold",
          borderLeft: "border-l-4 border-l-orange-500",
          btn: "bg-orange-600 hover:bg-orange-500 text-white",
        };
      case "MEDIUM":
        return {
          bg: "bg-amber-500/10 border-amber-500/40 text-amber-300",
          badge: "bg-amber-600 text-white font-semibold",
          borderLeft: "border-l-4 border-l-amber-500",
          btn: "bg-amber-600 hover:bg-amber-500 text-white",
        };
      default:
        return {
          bg: "bg-slate-850 border-slate-800 text-slate-300",
          badge: "bg-slate-700 text-slate-200",
          borderLeft: "border-l-4 border-l-slate-600",
          btn: "bg-slate-800 hover:bg-slate-700 text-slate-200",
        };
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return {
          card: "bg-red-500/10 border-red-500/30 text-red-400",
          badge: "bg-red-600 text-white",
          bar: "bg-red-500",
        };
      case "HIGH":
        return {
          card: "bg-orange-500/10 border-orange-500/30 text-orange-400",
          badge: "bg-orange-600 text-white",
          bar: "bg-orange-500",
        };
      case "MEDIUM":
        return {
          card: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          badge: "bg-amber-600 text-white",
          bar: "bg-amber-500",
        };
      default:
        return {
          card: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          badge: "bg-emerald-600 text-white",
          bar: "bg-emerald-500",
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <ProjectNav projectId={projectId} />

        {/* Executive Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {dashboard?.project.name || "Manager Decision Center"}
                </h1>
                <span className="text-xs uppercase font-bold px-3 py-1 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  {dashboard?.project.status || "ACTIVE"}
                </span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Command Center
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                {dashboard?.project.location && (
                  <span className="flex items-center gap-1">
                    📍 {dashboard.project.location}
                  </span>
                )}
                <span>
                  🏗️ <strong>{dashboard?.project.site_count ?? 0}</strong> Sites
                </span>
                <span>
                  📍 <strong>{dashboard?.project.area_count ?? 0}</strong> Areas
                </span>
                {lastRefreshed && (
                  <span className="text-slate-500">
                    Last refreshed: {lastRefreshed}
                  </span>
                )}
              </div>
            </div>

            {/* Filter Controls Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
              {/* Site Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-medium">Site:</span>
                <select
                  value={selectedSiteId || ""}
                  onChange={(e) =>
                    setSelectedSiteId(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
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
              <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                {[
                  { label: "24h", val: 1 },
                  { label: "7d", val: 7 },
                  { label: "30d", val: 30 },
                ].map((t) => (
                  <button
                    key={t.val}
                    onClick={() => setDays(t.val)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                      days === t.val
                        ? "bg-cyan-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
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
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                🔄
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading && !dashboard ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading Manager Decision Center...</p>
          </div>
        ) : dashboard ? (
          <>
            {/* Data Confidence Banner if Low */}
            {dashboard.executive_health.data_confidence === "LOW" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="text-base">ℹ</span>
                  <span>
                    <strong>Limited Data Available:</strong> Few field safety records logged for the selected period. Lack of records does not confirm complete site safety.
                  </span>
                </div>
                <Link
                  href={`/projects/${projectId}/observations`}
                  className="font-bold underline hover:text-white"
                >
                  Log Observation →
                </Link>
              </div>
            )}

            {/* PART 2: Executive Health Top Strip (5 Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Card 1: Risk */}
              <div
                className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  getRiskColor(dashboard.executive_health.risk_level).card
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Project Risk
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      getRiskColor(dashboard.executive_health.risk_level).badge
                    }`}
                  >
                    {dashboard.executive_health.risk_level}
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-3xl font-black text-white">
                    {dashboard.executive_health.risk_score}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">/ 100</span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  Trend: <strong>{dashboard.executive_health.risk_trend}</strong>
                </div>
              </div>

              {/* Card 2: Progress */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Progress
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {dashboard.executive_health.progress_trend}
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-3xl font-black text-white">
                    {dashboard.executive_health.progress_pct !== null
                      ? `${dashboard.executive_health.progress_pct}%`
                      : "N/A"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Workers: <strong>{dashboard.progress.latest_workers ?? "N/A"}</strong> on site
                </div>
              </div>

              {/* Card 3: Open Safety Issues */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Open Safety Issues
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
                    Active
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-3xl font-black text-white">
                    {dashboard.executive_health.open_safety_issues}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dashboard.safety.ai_findings_open} AI + {dashboard.safety.human_incidents_open} Incidents
                </div>
              </div>

              {/* Card 4: Open Observations */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Observations
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Field Logs
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-3xl font-black text-white">
                    {dashboard.executive_health.open_observations}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dashboard.safety.observations_total} Total observations
                </div>
              </div>

              {/* Card 5: Operational Blockers */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Ops Blockers
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Supply / Ops
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-3xl font-black text-white">
                    {dashboard.executive_health.operational_blockers}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {dashboard.materials.low_stock_materials.length} Low stock + {dashboard.materials.open_blockers.length} Blockers
                </div>
              </div>
            </div>

            {/* PART 3: "WHAT NEEDS ATTENTION?" Prioritized Queue */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚨</span>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    What Needs Attention?
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {dashboard.attention_items.length} Actionable Alert(s)
                </span>
              </div>

              {dashboard.attention_items.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
                  ✓ No critical alerts or urgent safety blockers detected for this time window.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {dashboard.attention_items.map((item, idx) => {
                    const style = getPriorityStyle(item.priority);
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border bg-slate-950/80 flex flex-col justify-between space-y-3 ${style.borderLeft} ${style.bg}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              {item.title}
                            </span>
                            <span
                              className={`text-[10px] uppercase px-2 py-0.5 rounded ${style.badge}`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <span className="text-[11px] font-mono text-slate-400 uppercase">
                            {item.category.replace(/_/g, " ")}
                          </span>
                          <Link
                            href={item.action_url}
                            className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${style.btn}`}
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

            {/* Middle Row: Area Risk Ranking & Risk Explainability */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Area Risk Ranking Table */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Highest-Risk Areas Ranking
                    </h3>
                    <p className="text-xs text-slate-400">
                      Ranked zones sorted by safety risk score descending.
                    </p>
                  </div>
                  <Link
                    href={`/projects/${projectId}/intelligence`}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    View All Zones →
                  </Link>
                </div>

                {dashboard.area_risk.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No areas monitored yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Area</th>
                          <th className="py-2.5 px-3">Risk Score</th>
                          <th className="py-2.5 px-3">Level</th>
                          <th className="py-2.5 px-3">AI Findings</th>
                          <th className="py-2.5 px-3">Incidents</th>
                          <th className="py-2.5 px-3">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {dashboard.area_risk.slice(0, 5).map((area, idx) => (
                          <tr key={idx} className="hover:bg-slate-850/40 transition">
                            <td className="py-2.5 px-3 font-semibold text-white">
                              <span className="text-slate-500 mr-1.5">#{idx + 1}</span>
                              {area.area_name}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-white mr-2">
                                {area.risk_score}
                              </span>
                              <span className="text-[10px] text-slate-500">/ 100</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  getRiskColor(area.risk_level).badge
                                }`}
                              >
                                {area.risk_level}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-cyan-400">
                              {area.ai_findings_count}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-red-400">
                              {area.incidents_count}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {area.trend === "INCREASING" ? (
                                <span className="text-red-400">↑ Up</span>
                              ) : area.trend === "DECREASING" ? (
                                <span className="text-emerald-400">↓ Down</span>
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

              {/* Safety Risk Explainability Card */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center justify-between">
                    <span>Why Is This Risk Score Assigned?</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded font-bold ${
                        getRiskColor(dashboard.risk.level).badge
                      }`}
                    >
                      {dashboard.risk.score} / 100
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 mb-3">
                    Explainable deterministic breakdown based on active site records:
                  </p>

                  <div className="space-y-2">
                    {dashboard.risk.reasons && dashboard.risk.reasons.length > 0 ? (
                      dashboard.risk.reasons.slice(0, 4).map((r, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-xs text-slate-200"
                        >
                          <span className="text-cyan-400">•</span>
                          <span>{r}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 py-4 text-center">
                        No active safety hazards recorded for this window.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 italic">
                  ℹ {dashboard.risk.disclaimer}
                </div>
              </div>
            </div>

            {/* Bottom Row: AI PPE Vision & Inspections & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* PPE & Inspections Summary */}
              <div className="lg:col-span-6 space-y-6">
                {/* PPE Violations Grid */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">
                      AI PPE Computer Vision Insights
                    </h3>
                    <Link
                      href={`/projects/${projectId}/photos`}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      Open Vision Gallery →
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-lg mb-1">👷</div>
                      <div className="text-lg font-bold text-white">
                        {dashboard.safety.ppe_breakdown.no_helmet}
                      </div>
                      <div className="text-[10px] text-slate-400">Missing Helmet</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-lg mb-1">🧤</div>
                      <div className="text-lg font-bold text-white">
                        {dashboard.safety.ppe_breakdown.no_gloves}
                      </div>
                      <div className="text-[10px] text-slate-400">Missing Gloves</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-lg mb-1">🥾</div>
                      <div className="text-lg font-bold text-white">
                        {dashboard.safety.ppe_breakdown.no_boots}
                      </div>
                      <div className="text-[10px] text-slate-400">Missing Boots</div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-lg mb-1">🥽</div>
                      <div className="text-lg font-bold text-white">
                        {dashboard.safety.ppe_breakdown.no_goggles}
                      </div>
                      <div className="text-[10px] text-slate-400">Missing Goggles</div>
                    </div>
                  </div>
                </div>

                {/* Inspections & Materials */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">
                      Quality & Safety Inspections
                    </h3>
                    <Link
                      href={`/projects/${projectId}/inspections`}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      View Reports →
                    </Link>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400">Total</div>
                      <div className="text-xl font-bold text-white mt-1">
                        {dashboard.safety.inspections_total}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-emerald-950/50">
                      <div className="text-xs text-emerald-300">Passed</div>
                      <div className="text-xl font-bold text-emerald-400 mt-1">
                        {dashboard.safety.inspections_passed}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-red-950/50">
                      <div className="text-xs text-red-300">Failed</div>
                      <div className="text-xl font-bold text-red-400 mt-1">
                        {dashboard.safety.inspections_failed}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Stream */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">
                    Live Field Activity Feed
                  </h3>
                  <span className="text-xs text-slate-500">
                    Latest {dashboard.recent_activity.length} Events
                  </span>
                </div>

                {dashboard.recent_activity.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No field activity logged yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {dashboard.recent_activity.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-start gap-3 text-xs"
                      >
                        <span className="text-base mt-0.5">
                          {act.type === "INCIDENT"
                            ? "⚠️"
                            : act.type === "PHOTO"
                            ? "📸"
                            : act.type === "REPORT"
                            ? "📋"
                            : act.type === "INSPECTION"
                            ? "🔍"
                            : act.type === "MATERIAL"
                            ? "🧱"
                            : "👁️"}
                        </span>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">
                              {act.title}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {act.date}
                            </span>
                          </div>
                          {act.description && (
                            <p className="text-slate-400 text-[11px] line-clamp-1">
                              {act.description}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 pt-0.5">
                            {act.user_name && <span>By {act.user_name}</span>}
                            {act.area_name && <span>• {act.area_name}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
