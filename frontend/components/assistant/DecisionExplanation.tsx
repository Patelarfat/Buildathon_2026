"use client";

import React, { useState } from "react";
import { Brain, Sparkles, Database, ShieldCheck, ChevronDown, ChevronUp, Cpu } from "lucide-react";

interface DecisionExplanationProps {
  dataUsed?: string[];
  className?: string;
  isCompactButton?: boolean;
}

export default function DecisionExplanation({
  dataUsed,
  className = "",
  isCompactButton = true,
}: DecisionExplanationProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`text-xs ${className}`}>
      {/* Compact toggle button (Collapsed by default) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition-all font-medium text-[11px] shadow-2xs"
      >
        <Brain className="w-3.5 h-3.5 text-[#D99A16]" />
        <span>{open ? "Hide AI Decision Pipeline" : "🧠 Explain this answer"}</span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>

      {/* Expanded 4-Step Pipeline */}
      {open && (
        <div className="mt-2.5 p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200 space-y-3 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#D99A16]" />
              <span>How AI Formulated This Decision</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              Grounded Hybrid RAG
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {/* Step 1: SQL Facts */}
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                <span>1. SQL Facts</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                Exact structured project information queried directly from PostgreSQL.
              </p>
            </div>

            {/* Step 2: Vector RAG */}
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-purple-600" />
                <span>2. Vector RAG</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                Semantic retrieval of relevant project records using pgvector embeddings.
              </p>
            </div>

            {/* Step 3: Risk Engine */}
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Risk Engine</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                Deterministic 0–100 mathematical risk and recurring issue scoring.
              </p>
            </div>

            {/* Step 4: Gemini Synthesis */}
            <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-[#D99A16]" />
                <span>4. Gemini</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">
                Converts grounded information into a manager-friendly, actionable response.
              </p>
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
                  className="text-[10px] px-2 py-0.5 rounded bg-white text-slate-700 font-medium border border-slate-200"
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

