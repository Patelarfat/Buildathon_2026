"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import {
  getProject,
  getProjectDashboard,
  chatWithAssistant,
  ProjectDetail,
  ManagerDashboardData,
  AssistantChatResponse,
} from "@/lib/api";
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";
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
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: AssistantChatResponse["sources"];
  timestamp: string;
  isError?: boolean;
}

const SUGGESTED_INSIGHTS = [
  {
    title: "What are the top safety risks?",
    query: "What are the top safety risks on this project?",
    category: "Safety & PPE",
  },
  {
    title: "Why is the project risk high or medium?",
    query: "Why is the project risk high or medium?",
    category: "Risk Analytics",
  },
  {
    title: "Are there recurring safety issues?",
    query: "Are there any recurring safety issues or trends?",
    category: "Operations",
  },
  {
    title: "Which incidents are unresolved?",
    query: "List any unresolved safety incidents and failed inspections.",
    category: "Quality Control",
  },
  {
    title: "What materials need attention?",
    query: "What is the status of critical materials and blockers?",
    category: "Supply & Stock",
  },
  {
    title: "Summarize today's site activity.",
    query: "Give me a summary of today's site activities and PPE compliance.",
    category: "Daily Progress",
  },
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [p, d] = await Promise.all([
          getProject(projectId),
          getProjectDashboard(projectId).catch(() => null),
        ]);
        setProject(p);
        setDashboard(d);
      } catch (err: any) {
        setError(err.message || "Failed to load project details");
      }
    }
    if (projectId) {
      loadData();
    }
  }, [projectId]);

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
        sources: response.sources,
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
      {/* Shared Project Context Header & Stationary Navigation */}
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
            <span className="font-semibold">Live Project Context</span>
          </div>
        }
      />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-6">

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* 2. MAIN WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* CHAT WORKSPACE AREA */}
          <div className="lg:col-span-8 flex flex-col bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden shadow-xs min-h-[640px] max-h-[820px]">
            {/* AI Workspace Header */}
            <div className="p-4 sm:p-5 border-b border-[#E7E5E4] bg-[#FAF9F6] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5B82E]/20 border border-[#F5B82E]/40 text-[#0B0F14] flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#D99A16]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#171717] tracking-tight flex items-center gap-2">
                    <span>CONSTRUCTION INTELLIGENCE</span>
                    <Sparkles className="w-3.5 h-3.5 text-[#D99A16]" />
                  </h2>
                  <p className="text-xs text-slate-500">
                    AI PROJECT ASSISTANT — Ask questions about project health, safety, progress and field activity.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                Grounded Context
              </span>
            </div>

            {/* Chat Stream Area */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 scrollbar-thin">
              {messages.length === 0 ? (
                /* EMPTY CHAT STATE */
                <div className="py-6 sm:py-10 px-4 max-w-2xl mx-auto space-y-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5B82E]/20 border border-[#F5B82E]/40 text-[#D99A16] flex items-center justify-center mx-auto">
                    <Brain className="w-6 h-6" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#171717] tracking-tight">
                      CONSTRUCTION INTELLIGENCE
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
                      Get answers grounded in project records, safety incidents, inspections, PPE scans, materials, daily reports and risk analysis.
                    </p>
                  </div>

                  <div className="pt-2 text-left space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        START WITH AN INSIGHT
                      </span>
                      <span className="text-[11px] text-slate-400">Click to run analysis</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {SUGGESTED_INSIGHTS.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(item.query)}
                          className="p-3.5 rounded-xl bg-white border border-[#E7E5E4] hover:border-[#F5B82E] text-left transition-all duration-150 group flex flex-col justify-between space-y-2 hover:bg-[#FAF9F6] shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-[#D99A16] uppercase font-bold">
                              {item.category}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#D99A16] group-hover:translate-x-0.5 transition-all" />
                          </div>
                          <span className="text-xs font-semibold text-slate-800 group-hover:text-slate-900 line-clamp-2">
                            → {item.title}
                          </span>
                        </button>
                      ))}
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
                        {msg.sender === "user" ? "You" : "Construction Intelligence"}
                      </span>
                      <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[88%] sm:max-w-[84%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-[#171717] text-white rounded-tr-xs shadow-xs"
                          : msg.isError
                          ? "bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-xs"
                          : "bg-[#F9F9F8] border border-[#E7E5E4] text-slate-800 rounded-tl-xs shadow-xs space-y-3"
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans leading-relaxed">
                        {msg.text}
                      </div>

                      {/* Sources & Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-[#E7E5E4] space-y-2">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
                            REFERENCED PROJECT SOURCES
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.sources.map((src, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-white border border-[#E7E5E4] text-slate-700 shadow-2xs"
                              >
                                <span className="font-bold text-[#D99A16]">{src.type}</span>
                                {src.id && (
                                  <span className="text-slate-400 font-mono">#{src.id}</span>
                                )}
                                {src.title && (
                                  <span className="text-slate-500 truncate max-w-[180px]">
                                    ({src.title})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="bg-[#F9F9F8] border border-[#E7E5E4] rounded-2xl rounded-tl-xs p-4 shadow-xs flex items-center space-x-3">
                    <Loader2 className="w-4 h-4 text-[#D99A16] animate-spin" />
                    <span className="text-xs text-slate-600 font-medium">
                      Analyzing project records & safety data...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions Stream Bar when active */}
            {messages.length > 0 && (
              <div className="px-4 py-2.5 bg-[#FAF9F6] border-t border-[#E7E5E4] flex items-center gap-2 overflow-x-auto text-xs text-slate-500 scrollbar-none">
                <span className="whitespace-nowrap font-bold text-slate-700">Quick Analysis:</span>
                <button
                  onClick={() => handleSend("What are the recommended actions to reduce risk?")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs"
                >
                  Recommended Actions
                </button>
                <button
                  onClick={() => handleSend("Are there any material shortages blocking work?")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs"
                >
                  Material Blockers
                </button>
                <button
                  onClick={() => handleSend("Show PPE compliance breakdown")}
                  className="whitespace-nowrap px-3 py-1 rounded-lg bg-white hover:bg-slate-50 border border-[#E7E5E4] text-slate-700 transition-colors shadow-2xs"
                >
                  PPE Breakdown
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
                  placeholder="Ask anything about this project..."
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
                <span>Grounded Project Intelligence Active</span>
              </div>
            </div>
          </div>

          {/* RIGHT-SIDE PROJECT SNAPSHOT PANEL */}
          <div className="lg:col-span-4 space-y-6 hidden lg:block">
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="pb-3 border-b border-[#E7E5E4]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center justify-between">
                  <span>PROJECT SNAPSHOT</span>
                  <span className="text-[10px] text-slate-400 font-mono">Real-Time</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Real-time project context
                </p>
              </div>

              <div className="divide-y divide-[#E7E5E4] space-y-0">
                {/* Risk Score */}
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Risk Score</span>
                    <div className="text-xl font-extrabold text-[#171717] mt-0.5">
                      {dashboard?.executive_health.risk_score ?? 0}
                      <span className="text-xs font-normal text-slate-400 ml-1">/ 100</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {dashboard?.executive_health.risk_level ?? "LOW"}
                  </span>
                </div>

                {/* Progress */}
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Progress</span>
                    <div className="text-xl font-extrabold text-[#171717] mt-0.5">
                      {dashboard?.executive_health.progress_pct !== null && dashboard?.executive_health.progress_pct !== undefined
                        ? `${dashboard.executive_health.progress_pct}%`
                        : "N/A"}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {dashboard?.progress.latest_workers ?? "N/A"} workers
                  </span>
                </div>

                {/* Safety Issues */}
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Safety Issues</span>
                    <div className="text-xl font-extrabold text-[#171717] mt-0.5">
                      {dashboard?.executive_health.open_safety_issues ?? 0}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    {dashboard?.safety.human_incidents_open ?? 0} Incidents
                  </span>
                </div>

                {/* Observations */}
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase block">Observations</span>
                    <div className="text-xl font-extrabold text-[#171717] mt-0.5">
                      {dashboard?.executive_health.open_observations ?? 0}
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
                  The AI Assistant evaluates all queries against live site records for project #{projectId}.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
