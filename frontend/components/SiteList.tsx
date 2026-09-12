"use client";

import { useState } from "react";
import { Site, createSite, deleteSite } from "../lib/api";
import AreaList from "./AreaList";
import { Building2, Plus, MapPin, Trash2, HardHat, X } from "lucide-react";

interface SiteListProps {
  projectId: number;
  sites: Site[];
  onSitesChanged: () => void;
}

export default function SiteList({
  projectId,
  sites,
  onSitesChanged,
}: SiteListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Site name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createSite(projectId, {
        name: name.trim(),
        address: address.trim() || undefined,
        description: description.trim() || undefined,
      });
      setName("");
      setAddress("");
      setDescription("");
      setShowAddForm(false);
      onSitesChanged();
    } catch (err: any) {
      setError(err.message || "Failed to create site");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (siteId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this site? All associated areas will also be deleted."
      )
    )
      return;

    try {
      await deleteSite(siteId);
      onSitesChanged();
    } catch (err: any) {
      alert(err.message || "Failed to delete site");
    }
  };

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-2xl p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
        <div>
          <h3 className="text-lg font-bold text-[#171717] flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#F5B82E]" />
            <span>Construction Sites</span>
            <span className="text-xs bg-[#F6F6F3] text-[#171717] border border-[#E7E5E4] px-2.5 py-0.5 rounded-full font-semibold">
              {sites.length}
            </span>
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Physical job sites and zones under this project
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3.5 py-2 text-xs font-semibold bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{showAddForm ? "Close Form" : "+ Add Site"}</span>
        </button>
      </div>

      {/* Add Site Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#F6F6F3] p-5 rounded-2xl border border-[#E7E5E4] space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#171717]">Create New Site</h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[#6B7280] hover:text-[#171717]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Site Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Construction Site"
                className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Site Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 42, MIDC, Solapur"
                className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Site scope, boundaries, or special conditions"
              className="w-full bg-white border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E]"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3.5 py-1.5 text-xs text-[#6B7280] hover:text-[#171717]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a724] disabled:opacity-50 text-[#0B0F10] rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              {loading ? "Creating..." : "Create Site"}
            </button>
          </div>
        </form>
      )}

      {/* Sites List or Compact Empty State */}
      {sites.length === 0 ? (
        <div className="bg-[#F6F6F3]/60 border border-[#E7E5E4] rounded-2xl p-6 text-center space-y-3 my-2">
          <div className="w-12 h-12 bg-amber-50 text-[#F5B82E] border border-amber-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#171717]">
              No sites created yet
            </h4>
            <p className="text-xs text-[#6B7280] max-w-xs mx-auto mt-0.5">
              Add your first construction site to start organizing areas, field activity, and project operations.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create First Site</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white border border-[#E7E5E4] rounded-2xl p-5 hover:border-amber-300/60 transition-all shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-[#171717] flex items-center space-x-2">
                    <span>{site.name}</span>
                  </h4>
                  {site.address && (
                    <p className="text-xs text-[#6B7280] mt-1 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-[#6B7280]" />
                      <span>{site.address}</span>
                    </p>
                  )}
                  {site.description && (
                    <p className="text-xs text-[#171717] mt-2 leading-relaxed">
                      {site.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(site.id)}
                  className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors font-medium"
                >
                  Delete Site
                </button>
              </div>

              {/* Nested Area List */}
              <AreaList
                siteId={site.id}
                initialAreas={site.areas || []}
                onAreaChanged={onSitesChanged}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
