"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  getProject,
  getProjectIntelligence,
  Project,
  ProjectIntelligence,
  AreaRiskRankingItem,
  RecurringIssue,
} from "@/lib/api";

export default function ProjectIntelligencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);

  const [project, setProject] = useState<Project | null>(null);
  const [intel, setIntel] = useState<ProjectIntelligence | null>(null);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async (selectedDays: number) => {
    try {
      setLoading(true);
      setError(null);
      const [projData, intelData] = await Promise.all([
        getProject(projectId),
        getProjectIntelligence(projectId, selectedDays),
      ]);
      setProject(projData);
      setIntel(intelData);
    } catch (err: any) {
      setError(err?.message || "Failed to load project intelligence data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchIntelligence(days);
    }
  }, [projectId, days]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return {
          bg: "bg-red-500/10 border-red-500/30 text-red-400",
          badge: "bg-red-600 text-white",
          text: "text-red-400",
          bar: "bg-red-500",
        };
      case "HIGH":
        return {
          bg: "bg-orange-500/10 border-orange-500/30 text-orange-400",
          badge: "bg-orange-600 text-white",
          text: "text-orange-400",
          bar: "bg-orange-500",
        };
      case "MEDIUM":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          badge: "bg-amber-600 text-white",
          text: "text-amber-400",
          bar: "bg-amber-500",
        };
      default:
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          badge: "bg-emerald-600 text-white",
          text: "text-emerald-400",
          bar: "bg-emerald-500",
        };
    }
  };

  const getTrendBadge = (trend: string, changePct?: number) => {
    if (trend === "INCREASING") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
          ↑ Increasing {changePct !== undefined ? `(+${changePct}%)` : ""}
        </span>
      );
    }
    if (trend === "DECREASING") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          ↓ Improving {changePct !== undefined ? `(${changePct}%)` : ""}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-700 text-slate-300 border border-slate-600">
        → Stable
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
              <Link href="/projects" className="hover:text-cyan-400 transition">
                Projects
              </Link>
              <span>/</span>
              <Link
                href={`/projects/${projectId}`}
                className="hover:text-cyan-400 transition"
              >
                {project?.name || `Project #${projectId}`}
              </Link>
              <span>/</span>
              <span className="text-slate-200">Intelligence Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
                  Construction Intelligence Engine
                </span>
              </h1>
              <span className="text-xs uppercase px-2.5 py-1 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Phase 5 Active
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Transparent, explainable risk assessment, recurring issue detection, and multi-level intelligence.
            </p>
          </div>

          {/* Time Window Selector */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
            <span className="text-xs font-medium text-slate-400 px-2">Window:</span>
            {[
              { label: "24 Hours", val: 1 },
              { label: "7 Days", val: 7 },
              { label: "30 Days", val: 30 },
            ].map((t) => (
              <button
                key={t.val}
                onClick={() => setDays(t.val)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  days === t.val
                    ? "bg-cyan-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => fetchIntelligence(days)}
              title="Refresh intelligence data"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              🔄
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && !intel ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Evaluating multi-level site intelligence...</p>
          </div>
        ) : intel ? (
          <>
            {/* Top Row: Master Risk Score Hero & Explainability */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Score & Risk Card */}
              <div
                className={`lg:col-span-5 rounded-2xl border p-6 flex flex-col justify-between ${
                  getRiskColor(intel.project_risk.level).bg
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Overall Project Safety Risk
                    </span>
                    <span
                      className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                        getRiskColor(intel.project_risk.level).badge
                      }`}
                    >
                      {intel.project_risk.level} RISK
                    </span>
                  </div>

                  <div className="flex items-baseline gap-3 my-2">
                    <span className="text-6xl font-black tracking-tight text-white">
                      {intel.project_risk.score}
                    </span>
                    <span className="text-xl font-medium text-slate-400">/ 100</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {getTrendBadge(
                      intel.trends.safety_trend,
                      intel.trends.safety_change_pct
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      Confidence: <strong>{intel.project_risk.data_confidence}</strong>
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      Window: <strong>{intel.time_window_days} Days</strong>
                    </span>
                  </div>

                  {intel.highest_risk_area && (
                    <div className="mt-6 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-xs text-slate-400 font-medium">Highest Risk Zone:</div>
                      <div className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                        <span className="text-amber-400">⚠</span> {intel.highest_risk_area}
                        {intel.highest_risk_site && (
                          <span className="text-xs text-slate-400 font-normal">
                            ({intel.highest_risk_site})
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub-scores Mini Breakdown */}
                <div className="mt-6 pt-4 border-t border-slate-800/60 space-y-2">
                  <div className="text-xs font-semibold text-slate-400 mb-2">
                    Capped Scoring Formula Components:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">AI Findings</div>
                      <div className="font-bold text-white">
                        {intel.project_risk.components.ai_findings} / 30
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Incidents</div>
                      <div className="font-bold text-white">
                        {intel.project_risk.components.incidents} / 30
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Observations</div>
                      <div className="font-bold text-white">
                        {intel.project_risk.components.observations} / 15
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Inspections</div>
                      <div className="font-bold text-white">
                        {intel.project_risk.components.inspections} / 15
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Recurring</div>
                      <div className="font-bold text-white">
                        {intel.project_risk.components.recurring} / 15
                      </div>
                    </div>
                    <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400">Trend Adj.</div>
                      <div className="font-bold text-white">
                        {intel.project_risk.components.trend > 0
                          ? `+${intel.project_risk.components.trend}`
                          : intel.project_risk.components.trend}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explainability Card */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-white">
                      Why is this project classified as{" "}
                      <span className={getRiskColor(intel.project_risk.level).text}>
                        {intel.project_risk.level} Risk
                      </span>
                      ?
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    The intelligence engine provides transparent, deterministic reasons based on real site records:
                  </p>

                  <div className="space-y-2.5">
                    {intel.project_risk.reasons && intel.project_risk.reasons.length > 0 ? (
                      intel.project_risk.reasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80"
                        >
                          <span className="text-cyan-400 text-sm mt-0.5">•</span>
                          <span className="text-sm text-slate-200 leading-relaxed font-medium">
                            {reason}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No active safety hazards recorded for this period.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500 italic">
                  ℹ {intel.project_risk.disclaimer}
                </div>
              </div>
            </div>

            {/* Recurring Issues Section */}
            {intel.recurring_issues && intel.recurring_issues.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-lg">⚠</span>
                    <h2 className="text-lg font-bold text-white">
                      Detected Recurring Issues (≥3 occurrences in 7-day window)
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {intel.recurring_issues.length} Active Recurring Problem(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {intel.recurring_issues.map((ri, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {ri.issue_category}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            ri.severity === "HIGH" || ri.severity === "CRITICAL"
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {ri.severity}
                        </span>
                      </div>

                      <div className="font-bold text-white text-base">
                        {ri.issue_type.replace(/_/g, " ")}
                      </div>

                      <div className="text-xs text-slate-400">
                        Location:{" "}
                        <strong className="text-slate-200">
                          {ri.area_name || "General Area"}
                        </strong>{" "}
                        {ri.site_name ? `(${ri.site_name})` : ""}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                        <span className="text-amber-400 font-bold">
                          {ri.occurrence_count} Occurrences
                        </span>
                        <span className="text-slate-400">
                          Last seen: {ri.last_seen.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Area Risk Ranking Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Area Safety Risk Ranking
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hierarchical drill-down showing risk scores and active issues sorted highest risk first.
                  </p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg">
                  {intel.area_risks.length} Area(s) Monitored
                </span>
              </div>

              {intel.area_risks.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  No areas defined for this project yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Rank / Area</th>
                        <th className="py-3 px-4">Site</th>
                        <th className="py-3 px-4">Risk Score</th>
                        <th className="py-3 px-4">Level</th>
                        <th className="py-3 px-4">AI PPE Findings</th>
                        <th className="py-3 px-4">Incidents</th>
                        <th className="py-3 px-4">Observations</th>
                        <th className="py-3 px-4">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {intel.area_risks.map((area, idx) => (
                        <tr
                          key={area.area_id}
                          className="hover:bg-slate-850/40 transition"
                        >
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-800 text-xs flex items-center justify-center font-bold text-slate-400">
                                #{idx + 1}
                              </span>
                              <span>{area.area_name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 text-xs">
                            {area.site_name}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-base">
                                {area.risk_score}
                              </span>
                              <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full ${getRiskColor(area.risk_level).bar}`}
                                  style={{ width: `${Math.min(area.risk_score, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                getRiskColor(area.risk_level).badge
                              }`}
                            >
                              {area.risk_level}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-300">
                            {area.ai_findings_count > 0 ? (
                              <span className="text-cyan-400 font-bold">
                                {area.ai_findings_count}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-300">
                            {area.incidents_count > 0 ? (
                              <span className="text-red-400 font-bold">
                                {area.incidents_count}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-300">
                            {area.observations_count > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {area.observations_count}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {getTrendBadge(area.trend)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Safety Summary & PPE Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Safety Summary Grid */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Field Safety & Inspection Metrics
                  </h2>
                  <p className="text-xs text-slate-400">
                    Human-reported incidents vs AI early-warning findings.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">AI PPE Findings</div>
                    <div className="text-2xl font-bold text-cyan-400 mt-1">
                      {intel.safety_summary.ai_findings_open}
                      <span className="text-xs text-slate-500 font-normal ml-1.5">
                        / {intel.safety_summary.ai_findings_total} total
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Automated CV detections</div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Human Incidents</div>
                    <div className="text-2xl font-bold text-red-400 mt-1">
                      {intel.safety_summary.human_incidents_open}
                      <span className="text-xs text-slate-500 font-normal ml-1.5">
                        / {intel.safety_summary.human_incidents_total} total
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Confirmed officer reports</div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Open Observations</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">
                      {intel.safety_summary.observations_open}
                      <span className="text-xs text-slate-500 font-normal ml-1.5">
                        / {intel.safety_summary.observations_total} total
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Field observations</div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Inspection Failure Rate</div>
                    <div className="text-2xl font-bold text-purple-400 mt-1">
                      {intel.safety_summary.inspection_failure_rate_pct}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {intel.safety_summary.inspections_failed} failed of {intel.safety_summary.inspections_total}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between text-slate-400">
                  <span>Comparison: {intel.safety_summary.human_vs_ai_ratio}</span>
                  {intel.safety_summary.avg_resolution_time_hours !== null && (
                    <span>Avg Resolution: {intel.safety_summary.avg_resolution_time_hours} hrs</span>
                  )}
                </div>
              </div>

              {/* PPE Violations Breakdown */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    AI PPE Violation Distribution
                  </h2>
                  <p className="text-xs text-slate-400">
                    Specific PPE violation types detected by Computer Vision models.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>👷</span> Missing Helmet
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {intel.safety_summary.ppe_breakdown.no_helmet}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>🧤</span> Missing Gloves
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {intel.safety_summary.ppe_breakdown.no_gloves}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>🥾</span> Missing Boots
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {intel.safety_summary.ppe_breakdown.no_boots}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span>🥽</span> Missing Goggles
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">
                      {intel.safety_summary.ppe_breakdown.no_goggles}
                    </div>
                  </div>
                </div>

                {/* Visual Daily Series Bar Chart */}
                {intel.trends.daily_series && intel.trends.daily_series.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 mb-3">
                      Safety Activity Timeline ({days} Days):
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {intel.trends.daily_series.slice(-7).map((d, i) => (
                        <div
                          key={i}
                          className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-center"
                        >
                          <div className="text-[10px] text-slate-500 font-mono">
                            {d.date.slice(5)}
                          </div>
                          <div
                            className={`text-sm font-bold mt-1 ${
                              d.total_safety > 0 ? "text-cyan-400" : "text-slate-600"
                            }`}
                          >
                            {d.total_safety}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress & Operational Risk */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Progress Intelligence */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Progress & Workforce Intelligence
                    </h2>
                    <p className="text-xs text-slate-400">
                      Derived from daily supervisor reports.
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Trend: {intel.progress.progress_trend}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Latest Progress</div>
                    <div className="text-xl font-bold text-white mt-1">
                      {intel.progress.latest_progress_pct !== null
                        ? `${intel.progress.latest_progress_pct}%`
                        : "N/A"}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Avg Workers On Site</div>
                    <div className="text-xl font-bold text-white mt-1">
                      {intel.progress.average_workers !== null
                        ? intel.progress.average_workers
                        : "N/A"}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400">Blocked Days</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">
                      {intel.progress.blocked_days_count}
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Risk */}
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Operational Risk Summary
                    </h2>
                    <p className="text-xs text-slate-400">
                      Materials supply & site blockers (Kept separate from safety score).
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded font-bold ${
                      intel.operational_risk.operational_risk_level === "HIGH"
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : intel.operational_risk.operational_risk_level === "MEDIUM"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {intel.operational_risk.operational_risk_level} OP RISK
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {intel.operational_risk.low_stock_materials.length > 0 && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
                      <strong>Low Stock Alert:</strong>{" "}
                      {intel.operational_risk.low_stock_materials
                        .map((m) => `${m.material_name} (${m.quantity} ${m.unit})`)
                        .join(", ")}
                    </div>
                  )}

                  {intel.operational_risk.open_blockers.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300">
                      <strong>Active Site Blocker:</strong>{" "}
                      {intel.operational_risk.open_blockers.join(" | ")}
                    </div>
                  )}

                  {intel.operational_risk.low_stock_materials.length === 0 &&
                    intel.operational_risk.open_blockers.length === 0 && (
                      <div className="p-4 text-center text-slate-500">
                        No material shortages or active site blockers recorded.
                      </div>
                    )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
