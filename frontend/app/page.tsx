"use client";

import { useEffect, useState } from "react";
import { getProjects, getHealth, Project } from "../lib/api";
import HeroSection from "../components/HeroSection";
import ProductValueStrip from "../components/ProductValueStrip";
import WorkspaceProjectsSection from "../components/WorkspaceProjectsSection";

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

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState<boolean>(true);

  const checkHealth = async () => {
    setHealth({ loading: true, status: null, error: null });
    try {
      const data = await getHealth();
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

  const loadProjects = async () => {
    setProjectsLoading(true);
    try {
      const data = await getProjects();
      setProjects(data || []);
    } catch (err) {
      console.warn("Failed to load projects for home page workspace section", err);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    loadProjects();
  }, []);

  return (
    <main className="min-h-screen bg-[#0B0F14] text-slate-900 font-sans selection:bg-[#F5B82E] selection:text-[#0B0F14]">
      {/* 1 - 5. Hero Section with Cinematic Background, Floating Panel & System Health */}
      <HeroSection
        health={health}
        onRecheckHealth={checkHealth}
        projects={projects}
      />

      {/* 6. Product Value Strip (Built for Modern Construction) */}
      <ProductValueStrip />

      {/* 7. Recent Projects / Workspace Section */}
      <WorkspaceProjectsSection
        projects={projects}
        loading={projectsLoading}
      />

      {/* Footer */}
      <footer className="bg-[#0B0F14] border-t border-slate-800/80 py-10 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 rounded-md bg-[#F5B82E] flex items-center justify-center text-[#0B0F14] font-extrabold text-[10px] tracking-wider">
              CS
            </div>
            <span className="font-bold text-slate-200">
              Construction Intelligence Platform
            </span>
          </div>
          <p>© {new Date().getFullYear()} Construction Intelligence SaaS. Enterprise Construction Technology & Safety Management.</p>
        </div>
      </footer>
    </main>
  );
}