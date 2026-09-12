"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getProject, chatWithAssistant, Project, AssistantChatResponse } from "@/lib/api";
import ProjectNav from "@/components/ProjectNav";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: AssistantChatResponse["sources"];
  timestamp: string;
  isError?: boolean;
}

const SAMPLE_QUESTIONS = [
  "What are the top safety risks on this project?",
  "Why is the project risk high or medium?",
  "Are there any recurring safety issues or trends?",
  "List any unresolved safety incidents and failed inspections.",
  "What is the status of critical materials and blockers?",
  "Give me a summary of today's site activities and PPE compliance."
];

export default function AssistantPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const p = await getProject(projectId);
        setProject(p);
      } catch (err: any) {
        setError(err.message || "Failed to load project info");
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              <h1 className="text-2xl font-bold text-white">GenAI Construction Assistant</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Natural-language project intelligence grounded in real PostgreSQL records and RiskEngine calculations.
            </p>
          </div>
          {project && (
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700">
                {project.name} (ID #{project.id})
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                Live Isolated Context
              </span>
            </div>
          )}
        </div>

        {/* Project Navigation Tabs */}
        <div className="mt-4">
          <ProjectNav projectId={projectId} />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Chat Area Container */}
        <div className="mt-6 flex-1 flex flex-col bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl min-h-[500px]">
          {/* Messages Stream */}
          <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto my-auto">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-3xl mb-4">
                  🏗️
                </div>
                <h3 className="text-lg font-semibold text-slate-200 mb-2">
                  Ask Anything About This Project
                </h3>
                <p className="text-sm text-slate-400 mb-6">
                  Queries are strictly grounded in project records, safety incidents, PPE scans, materials, inspections, and RiskEngine calculations.
                </p>

                <div className="w-full text-left">
                  <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3">
                    Suggested Questions:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SAMPLE_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="text-left text-xs p-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all duration-150 flex items-start gap-2"
                      >
                        <span className="text-blue-400 font-bold">›</span>
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-medium text-slate-400">
                      {msg.sender === "user" ? "You" : "Construction Assistant"}
                    </span>
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-br-none shadow-md"
                        : msg.isError
                        ? "bg-red-950/70 text-red-200 border border-red-800 rounded-bl-none"
                        : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                    {/* Sources & Citations */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
                          Referenced Project Sources:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300"
                            >
                              <span className="font-medium text-blue-400">{src.type}</span>
                              {src.id && (
                                <span className="text-slate-400 font-mono">#{src.id}</span>
                              )}
                              <span className="text-slate-400 truncate max-w-[200px]">({src.title})</span>
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
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-bl-none p-4 shadow-md flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-150" />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-300" />
                  <span className="text-xs text-slate-400 ml-1">Analyzing project records...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions when chat is active */}
          {messages.length > 0 && (
            <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs text-slate-400">
              <span className="whitespace-nowrap font-medium text-slate-400">Follow-up suggestions:</span>
              <button
                onClick={() => handleSend("What are the recommended actions to reduce risk?")}
                className="whitespace-nowrap px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
              >
                Recommended Actions
              </button>
              <button
                onClick={() => handleSend("Are there any material shortages blocking work?")}
                className="whitespace-nowrap px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
              >
                Material Blockers
              </button>
              <button
                onClick={() => handleSend("Show PPE compliance breakdown")}
                className="whitespace-nowrap px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
              >
                PPE Breakdown
              </button>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-4 bg-slate-900/90 border-t border-slate-800">
            <div className="flex gap-2">
              <textarea
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about project risks, incidents, inspections, daily logs, PPE..."
                disabled={isLoading}
                className="flex-1 bg-slate-950 text-slate-100 placeholder-slate-400 text-sm px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 resize-none min-h-[44px] max-h-[120px]"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !inputQuery.trim()}
                className="px-5 py-3 rounded-xl font-medium text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-400 text-white transition-colors duration-150 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <span>Send</span>
                <span className="text-xs">↗</span>
              </button>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Shift + Enter for new line • Enter to send</span>
              <span>Project #{projectId} Isolation Guaranteed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
