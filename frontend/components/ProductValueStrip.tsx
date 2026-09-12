"use client";

import { Building2, Camera, Shield, Brain } from "lucide-react";

export default function ProductValueStrip() {
  const capabilities = [
    {
      title: "Project Operations",
      subtitle: "Projects, sites and teams",
      icon: Building2,
    },
    {
      title: "Field Intelligence",
      subtitle: "Photos, reports and observations",
      icon: Camera,
    },
    {
      title: "Safety & Risk",
      subtitle: "Incidents, inspections and risk tracking",
      icon: Shield,
    },
    {
      title: "AI Assistant",
      subtitle: "Ask questions and understand your project data",
      icon: Brain,
    },
  ];

  return (
    <section id="insights" className="py-16 sm:py-20 bg-[#F6F7F5] border-t border-[#E4E7EC] text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header - Asymmetrical Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* Header Left */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-[2px] bg-[#F5B82E] inline-block" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                BUILT FOR MODERN CONSTRUCTION
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-slate-900 tracking-tight leading-tight">
              Everything your site needs.<br />
              One <span className="text-[#D99A16]">intelligent workspace.</span>
            </h2>
          </div>

          {/* Header Right */}
          <div className="lg:col-span-5">
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg">
              Manage projects, sites, teams and field operations with AI-powered insights. Improve safety, track progress and make better decisions with real-time intelligence.
            </p>
          </div>
        </div>

        {/* 4 Elegant Capability Columns (Light Theme with Subtle Icon Containers) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          {capabilities.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div
                key={idx}
                className="flex items-start space-x-4 p-4 rounded-xl transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[#ECEEEA] border border-[#E0E3DD] text-slate-800 flex items-center justify-center shrink-0">
                  <IconComponent className="w-6 h-6 text-slate-800" />
                </div>
                <div className="space-y-1 pt-0.5">
                  <h3 className="text-base font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-normal leading-normal">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

