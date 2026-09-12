"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProjectStatus, createProject } from "../../../lib/api";
import { ArrowLeft, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PLANNING");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project Name is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        status,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      router.push(`/projects/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4.5rem)] bg-[#F7F8FA] text-slate-900 font-sans selection:bg-[#F5B82E] selection:text-[#0B0F14] py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Back Navigation Link */}
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#D99A16] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </Link>
        </div>

        {/* Workspace Header */}
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <span className="w-6 h-[2px] bg-[#F5B82E] inline-block" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              PROJECT ONBOARDING
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111827] tracking-tight">
            Create new project
          </h1>
          <p className="text-sm text-[#667085] font-normal">
            Set up the core details for your construction project workspace, timeline, and location.
          </p>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Enterprise Form Container Card */}
        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 sm:p-10 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* SECTION 01: PROJECT DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  01 PROJECT DETAILS
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Solapur Commercial Complex"
                    className="w-full bg-white border border-[#D0D5DD] rounded-xl px-4 py-3 text-sm text-[#101828] placeholder-[#98A2B3] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-colors h-[48px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Solapur, Maharashtra"
                    className="w-full bg-white border border-[#D0D5DD] rounded-xl px-4 py-3 text-sm text-[#101828] placeholder-[#98A2B3] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-colors h-[48px]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 02: PROJECT STATUS & TIMELINE */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  02 PROJECT STATUS & TIMELINE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Initial Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full bg-white border border-[#D0D5DD] rounded-xl px-4 py-3 text-sm text-[#101828] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-colors h-[48px]"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Planned Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-[#D0D5DD] rounded-xl px-4 py-3 text-sm text-[#101828] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-colors h-[48px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-[#D0D5DD] rounded-xl px-4 py-3 text-sm text-[#101828] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-colors h-[48px]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 03: PROJECT SCOPE */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-[#E4E7EC] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  03 PROJECT SCOPE
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Project Scope & Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Provide a detailed summary of the construction scope, deliverables, and milestones..."
                  className="w-full bg-white border border-[#D0D5DD] rounded-xl px-4 py-3 text-sm text-[#101828] placeholder-[#98A2B3] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-colors min-h-[130px]"
                />
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="pt-6 border-t border-[#E4E7EC] flex items-center justify-between">
              <Link
                href="/projects"
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#F5B82E] hover:bg-[#D99A16] disabled:opacity-50 text-[#0B0F14] transition-all shadow-sm active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-[#0B0F14] animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>Create Project</span>
                    <ArrowRight className="w-4 h-4 text-[#0B0F14]" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

