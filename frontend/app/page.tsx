"use client";

import { useEffect, useState } from "react";

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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600/10 text-blue-500 mb-6 border border-blue-500/20">
          <svg
            className="w-8 h-8"
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

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-6">
          Construction Site Intelligence Platform
        </h1>

        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 mb-6">
          <p className="text-sm font-medium text-slate-400 mb-2">Backend Status</p>
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

        <button
          onClick={checkHealth}
          className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Recheck Status
        </button>
      </div>
    </main>
  );
}