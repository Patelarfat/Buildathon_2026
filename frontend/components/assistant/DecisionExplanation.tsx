"use client";

import React, { useState } from "react";
import {
  Brain,
  Sparkles,
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Search,
  CheckCircle,
  Activity,
  Layers,
} from "lucide-react";
import { AssistantExplainability } from "@/lib/api";

interface DecisionExplanationProps {
  dataUsed?: string[];
  explainability?: AssistantExplainability | null;
  className?: string;
  isCompactButton?: boolean;
}

export default function DecisionExplanation({
  dataUsed,
  explainability,
  className = "",
  isCompactButton = true,
}: DecisionExplanationProps) {
  const [open, setOpen] = useState(false);

  const getStepIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case "search":
        return <Search className="w-3.5 h-3.5 text-blue-600" />;
      case "database":
        return <Database className="w-3.5 h-3.5 text-purple-600" />;
      case "checkcircle":
      case "check_circle":
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
      case "activity":
        return <Activity className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#D99A16]" />;
    }
  };

  const steps = explainability?.pipeline_steps || [
    { name: "Query Expansion", description: "Semantic expansion across construction ontology", icon: "Search" },
    { name: "Hybrid Retrieval", description: "pgvector dense + lexical multi-query search", icon: "Database" },
    { name: "Evidence Grouping", description: "Multi-source corroboration and ranking", icon: "CheckCircle" },
  ];

  return (
    <div className={`text-xs ${className}`}>
      {/* Compact toggle button (Collapsed by default) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all font-medium text-[11px] shadow-2xs cursor-pointer"
      >
        <Brain className="w-3.5 h-3.5 text-[#D99A16]" />
        <span>{open ? "Hide AI Decision Pipeline" : "🧠 Explain this answer"}</span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>

      {/* Expanded Explainability Panel */}
      {open && (
        <div className="mt-2.5 p-4 rounded-xl bg-[#FAF9F6] border border-slate-200 space-y-3.5 shadow-xs animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-2.5 gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D99A16]" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                How AI Formulated This Decision
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                Retrieval: {explainability?.retrieval_mode || "HYBRID_RAG"}
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                LLM: {explainability?.llm_model || "Gemini 2.5 Flash"}
              </span>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Retrieval Mode</span>
              <div className="text-xs font-extrabold text-slate-900 font-mono">
                {explainability?.retrieval_mode || "HYBRID_RAG"}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">SQL Facts</span>
              <div className="text-xs font-extrabold text-blue-700 font-mono">
                {explainability?.sql_facts_count ?? 0}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Semantic Chunks</span>
              <div className="text-xs font-extrabold text-purple-700 font-mono">
                {explainability?.semantic_chunks_count ?? 6}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Risk Engine</span>
              <div className="text-xs font-extrabold text-slate-900 font-mono flex items-center gap-1">
                <span>{explainability?.risk_engine_score ?? 0} / 100</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {explainability?.risk_engine_level || "LOW"}
                </span>
              </div>
            </div>
          </div>

          {/* Pipeline Execution Steps */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Pipeline Execution Sequence
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {steps.map((st, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                    <span className="text-slate-400 font-mono">{idx + 1}.</span>
                    {getStepIcon(st.icon)}
                    <span>{st.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    {st.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {dataUsed && dataUsed.length > 0 && (
            <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Grounded Domains:
              </span>
              {dataUsed.map((item, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 font-medium border border-slate-200 font-mono"
                >
                  {item.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


