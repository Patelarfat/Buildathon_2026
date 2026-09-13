"use client";

import React from "react";
import {
  AssistantStructuredResponse,
  AssistantSource,
} from "@/lib/api";
import RiskCard from "./RiskCard";
import AttentionCard from "./AttentionCard";
import ActionList from "./ActionList";
import LocationCard from "./LocationCard";
import MaterialCard from "./MaterialCard";
import PPECard from "./PPECard";
import ProgressCard from "./ProgressCard";
import EvidenceSources from "./EvidenceSources";
import DecisionExplanation from "./DecisionExplanation";
import {
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";

interface AssistantResponseProps {
  content: string;
  structured?: AssistantStructuredResponse | null;
  sources?: AssistantSource[];
  dataUsed?: string[];
  onFollowUp?: (query: string) => void;
  className?: string;
}

export default function AssistantResponse({
  content,
  structured,
  sources,
  dataUsed,
  onFollowUp,
  className = "",
}: AssistantResponseProps) {
  // If structured data is available directly from the backend, render it directly!
  if (structured) {
    const qType = (structured.query_type || "GENERAL").toUpperCase();
    const isMaterialQuery = qType === "MATERIALS" || qType === "MATERIAL";
    const isPPEQuery = qType === "PPE";
    const isProgressQuery = qType === "PROGRESS" || qType === "DAILY_REPORT" || qType === "WEEKLY_PROGRESS_REPORT";
    const isAreaQuery = qType === "AREA" || qType === "AREA_SAFETY";
    const isRiskQuery = qType === "RISK" || qType === "SAFETY_RISK";
    const isActionsQuery = qType === "RECOMMENDED_ACTIONS";
    const isSafetyQuery = qType === "SAFETY_INCIDENTS" || qType === "ISSUES_SUMMARY" || qType === "RECURRING_ISSUES";

    const displaySources = (structured.sources && structured.sources.length > 0)
      ? structured.sources
      : (sources || []);

    const isGreetingOrOutOfScope = qType === "GREETING" || qType === "OUT_OF_SCOPE";

    return (
      <div className={`space-y-3.5 text-slate-800 ${className}`}>
        {/* 1. EXECUTIVE SUMMARY (Direct Situational Summary) */}
        {structured.executive_summary && (
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[#D99A16] tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>{isGreetingOrOutOfScope ? "Construction AI Assistant" : "Executive Situational Assessment"}</span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-slate-800 font-normal whitespace-pre-line">
              {structured.executive_summary}
            </p>
          </div>
        )}

        {/* 2. QUESTION-SPECIFIC PRIMARY CARDS */}

        {/* A. PPE VISION BREAKDOWN (For PPE Queries) */}
        {isPPEQuery && structured.ppe && (
          <PPECard ppe={structured.ppe} />
        )}

        {/* B. MATERIAL & SUPPLY CHAIN CARDS (For Material Queries) */}
        {isMaterialQuery && structured.materials && structured.materials.length > 0 && (
          <MaterialCard materials={structured.materials} />
        )}

        {/* C. PROGRESS & WORKFORCE (For Progress Queries) */}
        {isProgressQuery && structured.progress && (
          <ProgressCard progress={structured.progress} />
        )}

        {/* D. AUTHORITATIVE RISK STATUS GAUGE (For Risk Queries or General Overview) */}
        {(isRiskQuery || (!isMaterialQuery && !isPPEQuery && !isProgressQuery && !isSafetyQuery && !isActionsQuery && !isAreaQuery && !isGreetingOrOutOfScope)) && structured.risk && (
          <RiskCard risk={structured.risk} />
        )}

        {/* E. WHAT NEEDS ATTENTION (For Safety Incidents, Area, or General Overview) */}
        {(isSafetyQuery || isAreaQuery || (!isMaterialQuery && !isPPEQuery && !isProgressQuery && !isRiskQuery && !isActionsQuery && !isGreetingOrOutOfScope)) && structured.attention_items && structured.attention_items.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-rose-500" />
                WHAT NEEDS ATTENTION ({structured.attention_items.length})
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {structured.attention_items.map((item, idx) => (
                <AttentionCard key={idx} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* F. LOCATION & SPATIAL CONTEXT (For Area, Risk, or Safety Questions) */}
        {(isAreaQuery || isRiskQuery || isSafetyQuery) && structured.locations && structured.locations.length > 0 && (
          <LocationCard locations={structured.locations} />
        )}

        {/* G. RECOMMENDED ACTIONS (For Actions, Safety, Risk, or General Overview) */}
        {(isActionsQuery || isSafetyQuery || isRiskQuery || isAreaQuery || (!isMaterialQuery && !isPPEQuery && !isProgressQuery && !isGreetingOrOutOfScope)) && structured.recommended_actions && structured.recommended_actions.length > 0 && (
          <ActionList actions={structured.recommended_actions} />
        )}

        {/* 3. REFERENCED EVIDENCE (Ground-truth Citations) */}
        {!isGreetingOrOutOfScope && displaySources.length > 0 && (
          <EvidenceSources sources={displaySources} />
        )}

        {/* 4. COMPACT EXPLAINABILITY BUTTON (Collapsed by default, never repeats bulky 4-step cards) */}
        {!isGreetingOrOutOfScope && (
          <div className="pt-0.5">
            <DecisionExplanation dataUsed={dataUsed} />
          </div>
        )}

        {/* 5. SUGGESTED FOLLOW-UP CHIPS */}
        {onFollowUp && structured.suggested_followups && structured.suggested_followups.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Suggested Follow-up:
            </span>
            {structured.suggested_followups.map((prompt, fIdx) => (
              <button
                key={fIdx}
                onClick={() => onFollowUp(prompt)}
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-[#F5B82E] text-slate-700 hover:text-slate-900 transition-all shadow-2xs font-medium"
              >
                <span>{prompt}</span>
                <ArrowRight className="w-3 h-3 text-[#D99A16]" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback for simple raw string answers
  return (
    <div className={`space-y-3 text-slate-800 ${className}`}>
      <div className="whitespace-pre-wrap font-sans leading-relaxed text-xs sm:text-sm">
        {content}
      </div>
      {sources && sources.length > 0 && <EvidenceSources sources={sources} />}
      <DecisionExplanation dataUsed={dataUsed} />
    </div>
  );
}
