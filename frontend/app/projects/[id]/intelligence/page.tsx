"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  getProject,
  getProjectIntelligence,
  ProjectDetail,
  ProjectIntelligence,
} from "@/lib/api";
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";
import {
  ArrowLeft,
  RotateCw,
  Building2,
  Grid,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity as ActivityIcon,
  HardHat,
  ShieldAlert,
  Layers,
  Info,
  TrendingUp,
  ChevronRight,
  Brain,
  FileText,
  ClipboardCheck,
  AlertCircle,
  Package,
} from "lucide-react";

export default function ProjectIntelligencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [intel, setIntel] = useState<ProjectIntelligence | null>(null);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async (selectedDays: number) => {
    try {
      setLoading(true);
      setError(null);
      const [projData, intelData] = await Promise.all([
        getProject(projectId).catch(() => null),
        getProjectIntelligence(projectId, selectedDays),
      ]);
      if (projData) setProject(projData);
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

  const getRiskStatusBadge = (level: string) => {
    switch (level) {
      case "CRITICAL":
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
            {level} RISK
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            MEDIUM RISK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            LOW RISK
          </span>
        );
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
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-[#E7E5E4] shadow-xs">
            <span className="text-xs font-semibold text-slate-500 px-2">WINDOW</span>
            {[
              { label: "24 Hours", val: 1 },
              { label: "7 Days", val: 7 },
              { label: "30 Days", val: 30 },
            ].map((t) => (
              <button
                key={t.val}
                onClick={() => setDays(t.val)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  days === t.val
                    ? "bg-[#F5B82E] text-[#171717] shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => fetchIntelligence(days)}
              title="Refresh intelligence data"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border-l border-[#E7E5E4] pl-2.5"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight">
            Risk & Site Intelligence
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-normal leading-relaxed">
            Understand project risk, recurring issues and site-level safety signals from your field data.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {loading && !intel ? (
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-16 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
            <div className="w-8 h-8 border-3 border-[#F5B82E] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">
              Evaluating multi-level site intelligence & deterministic risk...
            </p>
          </div>
        ) : intel ? (
          <>
            {/* 2. HERO RISK SECTION (2-Column Analytics Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT: OVERALL PROJECT RISK */}
              <div className="lg:col-span-6 bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-500">
                    OVERALL PROJECT RISK
                  </span>
                  {getRiskStatusBadge(intel.project_risk.level)}
                </div>

                <div className="space-y-4">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-6xl sm:text-7xl font-black tracking-tight text-[#171717]">
                      {intel.project_risk.score}
                    </span>
                    <span className="text-2xl font-normal text-slate-400">/ 100</span>
                  </div>

                  {/* Horizontal Risk Spectrum Indicator */}
                  <div className="space-y-2 pt-1">
                    <div className="h-2 bg-slate-100 rounded-full relative overflow-hidden flex items-center">
                      <div
                        className="h-full bg-[#F5B82E] transition-all duration-300 rounded-full"
                        style={{ width: `${Math.max(Math.min(intel.project_risk.score, 100), 4)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span className="text-emerald-600">LOW (0-30)</span>
                      <span className="text-amber-600">MEDIUM (31-60)</span>
                      <span className="text-rose-600">HIGH (61-100)</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 pt-2">
                    <span className="font-semibold text-slate-900">
                      Trend: {intel.trends.safety_trend}
                    </span>
                    <span>•</span>
                    <span>Confidence: <strong>{intel.project_risk.data_confidence}</strong></span>
                    <span>•</span>
                    <span>Window: <strong>{intel.time_window_days} Days</strong></span>
                  </div>
                </div>

                {/* Capped Scoring Formula Components */}
                <div className="pt-5 border-t border-[#E7E5E4] space-y-3">
                  <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700 block">
                    SCORING BREAKDOWN
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E7E5E4]">
                      <span className="text-xs text-slate-500 uppercase block font-semibold">AI Findings</span>
                      <span className="font-extrabold text-[#171717] text-base mt-0.5 block">
                        {intel.project_risk.components.ai_findings} / 30
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E7E5E4]">
                      <span className="text-xs text-slate-500 uppercase block font-semibold">Incidents</span>
                      <span className="font-extrabold text-[#171717] text-base mt-0.5 block">
                        {intel.project_risk.components.incidents} / 30
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E7E5E4]">
                      <span className="text-xs text-slate-500 uppercase block font-semibold">Observations</span>
                      <span className="font-extrabold text-[#171717] text-base mt-0.5 block">
                        {intel.project_risk.components.observations} / 15
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#E7E5E4]">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Inspections</span>
                      <span className="font-extrabold text-[#171717] text-sm mt-0.5 block">
                        {intel.project_risk.components.inspections} / 15
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#E7E5E4]">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Recurring</span>
                      <span className="font-extrabold text-[#171717] text-sm mt-0.5 block">
                        {intel.project_risk.components.recurring} / 15
                      </span>
                    </div>
                    <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#E7E5E4]">
                      <span className="text-[10px] text-slate-500 uppercase block font-semibold">Trend Adj.</span>
                      <span className="font-extrabold text-[#171717] text-sm mt-0.5 block">
                        {intel.project_risk.components.trend > 0
                          ? `+${intel.project_risk.components.trend}`
                          : intel.project_risk.components.trend}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: RISK EXPLANATION */}
              <div className="lg:col-span-6 bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="pb-3 border-b border-[#E7E5E4]">
                    <h2 className="text-base sm:text-lg font-bold text-[#171717] tracking-tight">
                      WHY THIS RISK SCORE?
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                      The intelligence engine provides transparent, deterministic reasons based on real site records.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <span className="text-xs sm:text-sm font-extrabold text-slate-600 uppercase tracking-wider block">
                      PRIMARY SIGNAL
                    </span>
                    {intel.project_risk.reasons && intel.project_risk.reasons.length > 0 ? (
                      intel.project_risk.reasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-[#FAF9F6] border-l-4 border-l-[#F5B82E] border-y border-r border-[#E7E5E4] text-sm text-slate-800 font-medium leading-relaxed"
                        >
                          {reason}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E7E5E4] text-sm text-slate-500 text-center italic">
                        No active safety issues or incidents recorded for the selected period.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E7E5E4] text-xs sm:text-sm text-slate-500 italic">
                  Note: {intel.project_risk.disclaimer}
                </div>
              </div>
            </div>

            {/* 3. RECURRING ISSUES SECTION */}
            {intel.recurring_issues && intel.recurring_issues.length > 0 && (
              <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h2 className="text-base sm:text-lg font-bold text-[#171717]">
                      DETECTED RECURRING ISSUES
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    {intel.recurring_issues.length} Active Problem(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {intel.recurring_issues.map((ri, idx) => (
                    <div
                      key={idx}
                      className="bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                          {ri.issue_category}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            ri.severity === "HIGH" || ri.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {ri.severity}
                        </span>
                      </div>

                      <div className="font-bold text-[#171717] text-sm">
                        {ri.issue_type.replace(/_/g, " ")}
                      </div>

                      <div className="text-xs text-slate-500">
                        Location: <strong className="text-slate-800">{ri.area_name || "General Area"}</strong>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#E7E5E4] text-xs">
                        <span className="text-amber-800 font-bold">
                          {ri.occurrence_count} Occurrences
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          Last seen: {ri.last_seen.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. AREA SAFETY RANKING */}
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E7E5E4]">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#171717]">
                    AREA SAFETY RANKING
                  </h2>
                  <p className="text-sm text-slate-500">
                    Risk-ranked areas based on current site intelligence.
                  </p>
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                  {intel.area_risks.length} Area(s) Monitored
                </span>
              </div>

              {intel.area_risks.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="text-sm font-bold text-slate-800 uppercase">NO AREAS DEFINED</div>
                  <p className="text-xs text-slate-500">
                    Add site areas to begin monitoring area-level safety risk.
                  </p>
                  <Link
                    href={`/projects/${projectId}`}
                    className="inline-block mt-2 text-xs font-bold text-[#D99A16] hover:underline"
                  >
                    View Project Structure →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#FAF9F6] text-slate-500 uppercase tracking-wider border-b border-[#E7E5E4] text-xs font-bold">
                      <tr>
                        <th className="py-3.5 px-4">Area</th>
                        <th className="py-3.5 px-4">Site</th>
                        <th className="py-3.5 px-4">Risk Score</th>
                        <th className="py-3.5 px-4">Level</th>
                        <th className="py-3.5 px-4">AI Findings</th>
                        <th className="py-3.5 px-4">Incidents</th>
                        <th className="py-3.5 px-4">Observations</th>
                        <th className="py-3.5 px-4">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E5E4]">
                      {intel.area_risks.map((area, idx) => (
                        <tr key={area.area_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4 font-semibold text-slate-900">
                            <span className="text-slate-400 mr-2">#{idx + 1}</span>
                            {area.area_name}
                          </td>
                          <td className="py-4 px-4 text-slate-500">{area.site_name}</td>
                          <td className="py-4 px-4">
                            <span className="font-bold text-[#171717] text-base mr-1">
                              {area.risk_score}
                            </span>
                            <span className="text-xs text-slate-400">/ 100</span>
                          </td>
                          <td className="py-4 px-4">
                            {getRiskStatusBadge(area.risk_level)}
                          </td>
                          <td className="py-4 px-4 font-semibold text-slate-800">
                            {area.ai_findings_count}
                          </td>
                          <td className="py-4 px-4 font-semibold text-rose-600">
                            {area.incidents_count}
                          </td>
                          <td className="py-4 px-4 font-semibold text-amber-700">
                            {area.observations_count}
                          </td>
                          <td className="py-4 px-4 text-slate-600 font-medium">
                            {area.trend === "INCREASING" ? (
                              <span className="text-rose-600">↑ Increasing</span>
                            ) : area.trend === "DECREASING" ? (
                              <span className="text-emerald-600">↓ Improving</span>
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

            {/* 5. FIELD METRICS & PPE BREAKDOWN */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Safety Metrics */}
              <div className="lg:col-span-6 bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                <div className="pb-3 border-b border-[#E7E5E4]">
                  <h2 className="text-base sm:text-lg font-bold text-[#171717]">
                    FIELD SAFETY & INSPECTION METRICS
                  </h2>
                  <p className="text-sm text-slate-500">
                    Human-reported incidents vs AI early-warning findings.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4]">
                    <span className="text-xs text-slate-500 uppercase block font-semibold">AI PPE Findings</span>
                    <span className="text-3xl font-black text-slate-900 mt-1 block">
                      {intel.safety_summary.ai_findings_open}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        / {intel.safety_summary.ai_findings_total} total
                      </span>
                    </span>
                  </div>

                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4]">
                    <span className="text-xs text-slate-500 uppercase block font-semibold">Human Incidents</span>
                    <span className="text-3xl font-black text-rose-600 mt-1 block">
                      {intel.safety_summary.human_incidents_open}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        / {intel.safety_summary.human_incidents_total} total
                      </span>
                    </span>
                  </div>

                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4]">
                    <span className="text-xs text-slate-500 uppercase block font-semibold">Open Observations</span>
                    <span className="text-3xl font-black text-amber-700 mt-1 block">
                      {intel.safety_summary.observations_open}
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        / {intel.safety_summary.observations_total} total
                      </span>
                    </span>
                  </div>

                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4]">
                    <span className="text-xs text-slate-500 uppercase block font-semibold">Inspection Fail Rate</span>
                    <span className="text-3xl font-black text-slate-900 mt-1 block">
                      {intel.safety_summary.inspection_failure_rate_pct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* PPE Distribution */}
              <div className="lg:col-span-6 bg-white border border-[#E7E5E4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
                <div className="pb-3 border-b border-[#E7E5E4]">
                  <h2 className="text-base sm:text-lg font-bold text-[#171717]">
                    AI PPE VIOLATION DISTRIBUTION
                  </h2>
                  <p className="text-sm text-slate-500">
                    Specific PPE violation types detected by Computer Vision models.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <HardHat className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-700">Missing Helmet</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      {intel.safety_summary.ppe_breakdown.no_helmet}
                    </span>
                  </div>

                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <ShieldAlert className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-700">Missing Gloves</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      {intel.safety_summary.ppe_breakdown.no_gloves}
                    </span>
                  </div>

                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Layers className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-700">Missing Boots</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      {intel.safety_summary.ppe_breakdown.no_boots}
                    </span>
                  </div>

                  <div className="bg-[#FAF9F6] p-4 rounded-xl border border-[#E7E5E4] flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-700">Missing Goggles</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-900">
                      {intel.safety_summary.ppe_breakdown.no_goggles}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
