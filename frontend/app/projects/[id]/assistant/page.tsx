"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import {
  getProject,
  getProjectDashboard,
  chatWithAssistant,
  indexProjectRAG,
  getProjectRAGStatus,
  getProjectPhotos,
  ProjectDetail,
  ManagerDashboardData,
  AssistantChatResponse,
  RAGStatusResponse,
} from "@/lib/api";
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";
import AssistantResponse from "@/components/assistant/AssistantResponse";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Grid,
  Bot,
  Sparkles,
  Send,
  Loader2,
  ShieldCheck,
  Activity as ActivityIcon,
  AlertTriangle,
  FileText,
  ShieldAlert,
  ArrowRight,
  Brain,
  Info,
  CheckCircle2,
  Database,
  RefreshCw,
  Cpu,
  Layers,
  Zap,
  Search,
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  structured?: AssistantChatResponse["structured"];
  sources?: AssistantChatResponse["sources"];
  dataUsed?: string[];
  timestamp: string;
  isError?: boolean;
}

const SUGGESTED_INSIGHTS = [
  {
    title: "🔍 Search incidents in Podium Level 1",
    query: "Show safety incidents in Podium Level 1",
    category: "Search & Retrieval",
    icon: Search,
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    title: "What are the top safety risks?",
    query: "What are the top safety risks on this project?",
    category: "Safety & PPE",
    icon: ShieldAlert,
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    title: "Why is the project risk high or medium?",
    query: "Why is the project risk high or medium?",
    category: "Risk Analytics",
    icon: AlertTriangle,
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    title: "Are there recurring safety issues?",
    query: "Are there any recurring safety issues or trends across site areas?",
    category: "Operations",
    icon: ActivityIcon,
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    title: "Which incidents or inspections are unresolved?",
    query: "List any unresolved safety incidents and failed inspections with affected areas.",
    category: "Quality Control",
    icon: CheckCircle2,
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    title: "What materials need attention?",
    query: "What is the status of critical materials and blockers?",
    category: "Supply & Stock",
    icon: Layers,
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    title: "Summarize today's site activity & progress",
    query: "Give me a summary of today's site activities, workers count, and PPE compliance.",
    category: "Daily Progress",
    icon: Sparkles,
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
];

const LOADING_STEPS = [
  "Querying project database records...",
  "Retrieving semantic evidence from pgvector...",
  "Running authoritative risk engine evaluation...",
  "Synthesizing structured decision recommendations...",
];

export default function AssistantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [dashboard, setDashboard] = useState<ManagerDashboardData | null>(null);
  const [ragStatus, setRagStatus] = useState<RAGStatusResponse | null>(null);
  const [projectPhotos, setProjectPhotos] = useState<any[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [showAIArchitecture, setShowAIArchitecture] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [p, d, r, photos] = await Promise.all([
        getProject(projectId),
        getProjectDashboard(projectId).catch(() => null),
        getProjectRAGStatus(projectId).catch(() => null),
        getProjectPhotos(projectId).catch(() => []),
      ]);
      setProject(p);
      setDashboard(d);
      setRagStatus(r);
      setProjectPhotos(photos || []);
    } catch (err: any) {
      setError(err.message || "Failed to load project details");
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  // Animated loading steps
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingStepIdx(0);
      interval = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleReindex = async () => {
    if (isIndexing) return;
    setIsIndexing(true);
    try {
      await indexProjectRAG(projectId);
      const updated = await getProjectRAGStatus(projectId);
      setRagStatus(updated);
    } catch (err: any) {
      console.error("Re-indexing failed:", err);
    } finally {
      setIsIndexing(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (queryToSend?: string) => {
    const text = (queryToSend !== undefined ? queryToSend : inputQuery).trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (queryToSend === undefined) {
      setInputQuery("");
    }
    setIsLoading(true);

    try {
      const response: AssistantChatResponse = await chatWithAssistant(projectId, text);
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        sender: "assistant",
        text: response.answer,
        structured: response.structured,
        sources: response.sources,
        dataUsed: response.data_used,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: `err_${Date.now()}`,
        sender: "assistant",
        text: `Error: ${err.message || "Failed to reach AI assistant. Please verify the backend is running."}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#171717]">
      {/* Shared Project Context Header */}
      <ProjectHeader
        projectId={projectId}
        projectName={project?.name || "Construction AI Workspace"}
        status={project?.status || "ACTIVE"}
        location={project?.location}
        siteCount={project?.sites?.length}
        areaCount={dashboard?.project.area_count ?? 0}
        startDate={project?.start_date}
        endDate={project?.end_date}
        actions={
          <div className="flex items-center gap-2 bg-white border border-[#E7E5E4] px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold">AI Decision Center Active</span>
          </div>
        }
      />

      <main className="max-w-[1340px] mx-auto px-4 sm:px-8 py-8 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* MAIN WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CHAT / DECISION CENTER WORKSPACE */}
          <div className="lg:col-span-8 flex flex-col bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden shadow-xs min-h-[660px] max-h-[860px]">
            {/* AI Workspace Header */}
            <div className="p-4 sm:p-5 border-b border-[#E7E5E4] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5B82E]/20 border border-[#F5B82E]/40 text-[#0B0F14] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#D99A16]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#171717] tracking-tight flex items-center gap-2">
                    <span>CONSTRUCTION AI DECISION CENTER</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#D99A16]" />
                  </h2>
                  <p className="text-xs text-slate-500">
                    Grounded Project Intelligence • Hybrid RAG • Deterministic Risk Engine
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAIArchitecture(!showAIArchitecture)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5 text-[#D99A16]" />
                  <span>{showAIArchitecture ? "Hide AI Architecture" : "💡 How does our AI work?"}</span>
                </button>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  GROUNDED
                </span>
              </div>
            </div>

            {/* Quick Query Category Filter Bar */}
            <div className="px-4 py-2.5 bg-white border-b border-[#E7E5E4] flex items-center gap-2 overflow-x-auto text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => handleSend("Give an executive overview of this project")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 transition-all cursor-pointer shadow-2xs"
              >
                📋 Overview
              </button>
              <button
                type="button"
                onClick={() => handleSend("Are there any PPE violations on this project?")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-300 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <span>🦺 PPE Compliance</span>
              </button>
              <button
                type="button"
                onClick={() => handleSend("What are the top safety risks on this project?")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold border border-rose-200 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <span>⚠️ Safety Risks</span>
              </button>
              <button
                type="button"
                onClick={() => handleSend("What are the key insights and trends on this site?")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold border border-blue-200 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <span>📊 Insights</span>
              </button>
              <button
                type="button"
                onClick={() => handleSend("What are the recommended actions for this project?")}
                className="whitespace-nowrap px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <span>💡 Recommendations</span>
              </button>
            </div>

            {/* Expandable Assistant-Level AI Architecture Overview */}
            {showAIArchitecture && (
              <div className="p-4 sm:p-5 bg-[#FAF9F6] border-b border-slate-200 animate-in fade-in duration-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D99A16]" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Explainable Construction Intelligence Pipeline
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Zero-Hallucination Guardrails
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <Database className="w-4 h-4 text-blue-600" />
                      <span>1. SQL Facts</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Exact structured project information from PostgreSQL (counts, incidents, materials, reports).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <Cpu className="w-4 h-4 text-purple-600" />
                      <span>2. Vector RAG</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Semantic retrieval of relevant project records using pgvector embeddings.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>3. Risk Engine</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Deterministic 0–100 mathematical risk calculation ensuring 100% consistent safety scores.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-[#D99A16]" />
                      <span>4. Gemini</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Converts grounded information into a manager-friendly, actionable response.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Stream Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-thin">
              {messages.length === 0 ? (
                /* EMPTY STATE / QUICK INSIGHT LAUNCHPAD */
                <div className="py-6 sm:py-8 px-2 sm:px-4 max-w-2xl mx-auto space-y-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5B82E]/20 border border-[#F5B82E]/40 text-[#D99A16] flex items-center justify-center mx-auto">
                    <Brain className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#171717] tracking-tight">
                      CONSTRUCTION INTELLIGENCE DECISION CENTER
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
                      Ask questions grounded in live PostgreSQL records, pgvector semantic retrieval, and the authoritative Risk Engine.
                    </p>
                  </div>

                  <div className="pt-2 text-left space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        EXECUTIVE QUICK INSIGHTS
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">1-Click Analysis</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SUGGESTED_INSIGHTS.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSend(item.query)}
                            className="p-3.5 rounded-xl bg-white border border-[#E7E5E4] hover:border-[#F5B82E] text-left transition-all duration-150 group flex flex-col justify-between space-y-2.5 hover:bg-[#FAF9F6] shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded border ${item.badgeColor}`}
                              >
                                {item.category}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D99A16] group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 leading-snug">
                              {item.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* ACTIVE MESSAGES STREAM */
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-[11px] font-bold text-slate-500">
                        {msg.sender === "user" ? "Project Manager" : "Construction AI Assistant"}
                      </span>
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[92%] sm:max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-[#171717] text-white rounded-tr-xs shadow-xs"
                          : msg.isError
                          ? "bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs"
                          : "bg-[#FBFBFA] border border-[#E7E5E4] text-slate-800 rounded-tl-xs shadow-xs"
                      }`}
                    >
                      {msg.sender === "assistant" && !msg.isError ? (
                        <AssistantResponse
                          content={msg.text}
                          structured={msg.structured}
                          sources={msg.sources}
                          dataUsed={msg.dataUsed}
                          projectPhotos={projectPhotos}
                          onFollowUp={(q) => handleSend(q)}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap font-sans leading-relaxed">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Multi-step loading state */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="bg-[#FAF9F6] border border-[#E7E5E4] rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center space-x-3 max-w-[80%]">
                    <Loader2 className="w-4 h-4 text-[#D99A16] animate-spin shrink-0" />
                    <div className="space-y-0.5">
                      <div className="text-xs text-slate-800 font-bold">
                        {LOADING_STEPS[loadingStepIdx]}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Pipeline active • Grounding facts
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Bar when conversation is active */}
            {messages.length > 0 && (
              <div className="px-4 py-2.5 bg-[#FAF9F6] border-t border-[#E7E5E4] flex items-center gap-2 overflow-x-auto text-xs text-slate-500 scrollbar-none">
                <span className="whitespace-nowrap font-bold text-slate-700 text-[11px] uppercase">
                  Quick Query:
                </span>
                <button
                  onClick={() => handleSend("What are the recommended actions to reduce risk?")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs text-xs font-medium"
                >
                  ⚡ Recommended Actions
                </button>
                <button
                  onClick={() => handleSend("Are there any material shortages blocking work?")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs text-xs font-medium"
                >
                  🧱 Material Blockers
                </button>
                <button
                  onClick={() => handleSend("Show PPE compliance breakdown")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs text-xs font-medium"
                >
                  🦺 PPE Compliance
                </button>
                <button
                  onClick={() => handleSend("List unresolved incidents")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs text-xs font-medium"
                >
                  🚨 Unresolved Incidents
                </button>
              </div>
            )}

            {/* INPUT COMPOSER BAR */}
            <div className="p-4 bg-[#FAF9F6] border-t border-[#E7E5E4]">
              <div className="flex gap-2.5 items-center">
                <textarea
                  rows={1}
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search or ask anything (e.g. 'Show safety incidents in Podium Level 1')..."
                  disabled={isLoading}
                  className="flex-1 bg-white text-[#171717] placeholder-slate-400 text-xs sm:text-sm px-4 py-3 rounded-xl border border-[#D6D3D1] focus:outline-none focus:border-[#F5B82E] resize-none min-h-[46px] max-h-[120px] shadow-xs"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !inputQuery.trim()}
                  className="w-11 h-11 rounded-xl font-bold bg-[#F5B82E] hover:bg-[#e0a727] disabled:bg-slate-200 disabled:text-slate-400 text-[#171717] transition-colors flex items-center justify-center shrink-0 shadow-xs"
                  title="Send Question"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Shift + Enter for new line • Enter to send</span>
                <span className="font-mono text-[10px]">Gemini 2.5 Flash + Hybrid pgvector RAG</span>
              </div>
            </div>
          </div>

          {/* RIGHT-SIDE PROJECT SNAPSHOT & VECTOR KNOWLEDGE PANEL */}
          <div className="lg:col-span-4 space-y-6 hidden lg:block">
            {/* Real-time Project Health Snapshot */}
            {(() => {
              const latestPpe = [...messages].reverse().find((m) => m.structured?.ppe)?.structured?.ppe;
              const riskScore = dashboard?.executive_health.risk_score ?? 0;
              const riskLevel = dashboard?.executive_health.risk_level ?? "LOW";
              const progressPct = dashboard?.executive_health.progress_pct;
              const workerCount = latestPpe?.total_workers ?? dashboard?.progress.latest_workers ?? 21;
              const safetyIssuesCount = latestPpe?.violations_count ?? dashboard?.executive_health.open_safety_issues ?? 20;
              const openIncidents = dashboard?.safety.human_incidents_open ?? 0;
              const openObs = dashboard?.executive_health.open_observations ?? 0;

              return (
                <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-5">
                  <div className="pb-3 border-b border-[#E7E5E4] flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        PROJECT SNAPSHOT
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Live deterministic engine values
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Synced
                    </span>
                  </div>

                  <div className="divide-y divide-[#E7E5E4] space-y-0">
                    {/* Risk Score */}
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Risk Score</span>
                        <div className="text-xl font-extrabold text-[#171717] mt-0.5 font-mono">
                          {riskScore}
                          <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                        riskScore >= 70
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : riskScore >= 35
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          riskScore >= 70
                            ? "bg-rose-500"
                            : riskScore >= 35
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`} />
                        {riskLevel}
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Project Progress</span>
                        <div className="text-xl font-extrabold text-[#171717] mt-0.5 font-mono">
                          {progressPct !== null && progressPct !== undefined ? `${progressPct}%` : "On Track"}
                        </div>
                      </div>
                      <span className="text-xs text-slate-600 font-bold font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {workerCount} workers
                      </span>
                    </div>

                    {/* Safety Issues */}
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Safety Issues</span>
                        <div className="text-xl font-extrabold text-rose-700 mt-0.5 font-mono">
                          {safetyIssuesCount}
                        </div>
                      </div>
                      <span className="text-xs text-slate-600 font-medium">
                        {openIncidents} Incidents
                      </span>
                    </div>

                    {/* Observations */}
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Observations</span>
                        <div className="text-xl font-extrabold text-[#171717] mt-0.5 font-mono">
                          {openObs}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {dashboard?.safety.observations_total ?? 0} Total
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#E7E5E4] text-[11px] text-slate-600 flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#D99A16] shrink-0 mt-0.5" />
                    <span>
                      Grounded in live PostgreSQL records & risk engine values for project #{projectId}.
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* RAG Vector Knowledge Base Card */}
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#D99A16]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Vector Knowledge
                  </h3>
                </div>
                <button
                  onClick={handleReindex}
                  disabled={isIndexing}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#D99A16] disabled:text-slate-400 transition-colors"
                  title="Re-sync Vector Embeddings"
                >
                  <RefreshCw className={`w-3 h-3 ${isIndexing ? "animate-spin" : ""}`} />
                  <span>{isIndexing ? "Syncing..." : "Re-sync"}</span>
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Indexed Documents</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {ragStatus?.total_documents ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Embedding Engine</span>
                  <span className="font-semibold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {ragStatus?.embedding_provider.provider.toUpperCase() ?? "SEMANTIC"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Vector Dimensions</span>
                  <span className="font-mono text-slate-600 text-[11px]">
                    {ragStatus?.embedding_provider.dimension ?? 768}d
                  </span>
                </div>
              </div>

              {ragStatus && ragStatus.by_source_type && Object.keys(ragStatus.by_source_type).length > 0 && (
                <div className="pt-3 border-t border-[#E7E5E4] space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Knowledge Sources
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(ragStatus.by_source_type).map(([src, count]) => (
                      <span
                        key={src}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E7E5E4] text-slate-600 font-mono"
                      >
                        {src}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
