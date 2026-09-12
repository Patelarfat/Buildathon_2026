"use client";

import Link from "next/link";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";
import FloatingIntelligencePanel from "./FloatingIntelligencePanel";
import { Project } from "../lib/api";

interface HealthState {
  loading: boolean;
  status: string | null;
  error: string | null;
}

interface HeroSectionProps {
  health: HealthState;
  onRecheckHealth: () => void;
  projects: Project[];
}

export default function HeroSection({
  health,
  onRecheckHealth,
  projects,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[85vh] lg:min-h-[88vh] flex items-center justify-center bg-[#0B0F14] overflow-hidden">
      {/* Full-Bleed Construction Site Background Photograph */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
        style={{ backgroundImage: `url('/hero-construction.jpg')` }}
      >
        {/* Subtle Dark Gradient Overlay for Contrast & Photograph Visibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0F14]/90 via-[#0B0F14]/65 to-[#0B0F14]/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F14]/40 via-transparent to-[#0B0F14]" />
      </div>

      {/* Hero Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 lg:pt-36 pb-20 sm:pb-24 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Hero Content */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Eyebrow with Tiny Signature Yellow Accent Line */}
            <div className="flex items-center space-x-3">
              <span className="w-6 h-[2px] bg-[#F5B82E] inline-block" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">
                CONSTRUCTION INTELLIGENCE
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-white tracking-tight leading-[1.12] max-w-[600px]">
              See your site.<br />
              Understand the risk.<br />
              Act with <span className="text-[#F5B82E]">confidence.</span>
            </h1>

            {/* Supporting Text */}
            <p className="text-base sm:text-lg text-slate-300 max-w-[500px] leading-relaxed font-normal">
              One workspace for project operations, field data, safety, progress and AI-powered insights.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              {/* Primary CTA (Signature Yellow) */}
              <Link
                href="/projects"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-[#F5B82E] hover:bg-[#D99A16] text-[#0B0F14] text-xs sm:text-sm font-semibold transition-colors h-[46px]"
              >
                <span>Explore Projects</span>
                <ArrowRight className="w-4 h-4 text-[#0B0F14]" />
              </Link>

              {/* Secondary CTA (Transparent + Subtle Border) */}
              <Link
                href="/projects/new"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded bg-slate-900/40 hover:bg-slate-800/80 border border-white/15 text-white text-xs sm:text-sm font-medium transition-colors backdrop-blur-sm h-[46px]"
              >
                <Plus className="w-4 h-4 text-slate-300" />
                <span>New Project</span>
              </Link>
            </div>

            {/* Subtle System Status Text */}
            <div className="pt-4 flex items-center space-x-2 text-[11px] text-slate-400 font-normal opacity-85">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  health.status === "healthy" ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span>
                {health.loading
                  ? "Checking API connection..."
                  : health.status === "healthy"
                  ? "All systems operational · API connected"
                  : "Connection unavailable"}
              </span>
              <button
                onClick={onRecheckHealth}
                disabled={health.loading}
                className="text-slate-400 hover:text-white transition-colors ml-1"
                title="Recheck Health"
              >
                <RefreshCw className={`w-3 h-3 ${health.loading ? "animate-spin" : ""}`} />
              </button>
            </div>

          </div>

          {/* Right Column: Floating Panel Positioned in Middle-Right Area */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <FloatingIntelligencePanel projects={projects} />
          </div>

        </div>
      </div>
    </section>
  );
}



