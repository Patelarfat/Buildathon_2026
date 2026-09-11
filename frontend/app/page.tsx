"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HealthState = {
  loading: boolean;
  status: string | null;
  error: string | null;
};

export default function Home() {
  const [health, setHealth] = useState<HealthState>({
    loading: true,
    status: null,
    error: null,
  });

  const checkHealth = async () => {
    setHealth({ loading: true, status: null, error: null });
    try {
      const res = await fetch("http://127.0.0.1:8000/api/health");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setHealth({
        loading: false,
        status: data.status,
        error: null,
      });
    } catch (err) {
      setHealth({
        loading: false,
        status: null,
        error: "Backend Connection Failed",
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20 shadow-inner">
          <svg
            className="w-10 h-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Construction Site Intelligence Platform
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Phase 2: Project, Site, Area & Team Management System
          </p>
        </div>

        {/* Backend Status Box (Phase 1 Requirement) */}
        <div className="bg-slate-950/70 rounded-2xl p-4 border border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Backend Status
          </p>
          <div className="flex items-center justify-center space-x-2">
            {health.loading && (
              <span className="inline-flex items-center text-amber-400 font-semibold text-sm">
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse mr-2"></span>
                Connecting...
              </span>
            )}

            {!health.loading && health.status && (
              <span className="inline-flex items-center text-emerald-400 font-semibold text-sm">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full mr-2"></span>
                Connected ({health.status})
              </span>
            )}

            {!health.loading && health.error && (
              <span className="inline-flex items-center text-rose-400 font-semibold text-sm">
                <span className="w-2.5 h-2.5 bg-rose-400 rounded-full mr-2"></span>
                Failed ({health.error})
              </span>
            )}
          </div>
        </div>

        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/projects"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/30 text-center"
          >
            Explore Projects Portfolio →
          </Link>
          <button
            onClick={checkHealth}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition-colors"
          >
            Recheck Backend
          </button>
        </div>
      </div>
    </main>
  );
}
