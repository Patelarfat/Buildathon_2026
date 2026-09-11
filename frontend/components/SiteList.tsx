"use client";

import { useState } from "react";
import { Site, createSite, deleteSite } from "../lib/api";
import AreaList from "./AreaList";

interface SiteListProps {
  projectId: number;
  sites: Site[];
  onSitesChanged: () => void;
}

export default function SiteList({ projectId, sites, onSitesChanged }: SiteListProps) {
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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>🏗️ Construction Sites</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
              {sites.length}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical job sites and zones under this project
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-sm"
        >
          {showAddForm ? "Close Form" : "+ Add Site"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 space-y-4"
        >
          <h4 className="text-sm font-semibold text-white">Create New Site</h4>
          {error && (
            <div className="p-2 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Site Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Construction Site"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Site Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot 42, MIDC, Solapur"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Site scope, boundaries, or special conditions"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {loading ? "Creating..." : "Create Site"}
            </button>
          </div>
        </form>
      )}

      {sites.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
          <p className="text-slate-400 text-sm">No sites created for this project yet.</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
          >
            Create the first site
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>{site.name}</span>
                  </h4>
                  {site.address && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
                      <span>📍</span>
                      <span>{site.address}</span>
                    </p>
                  )}
                  {site.description && (
                    <p className="text-xs text-slate-300 mt-2">{site.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(site.id)}
                  className="px-2.5 py-1 text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 rounded border border-rose-900/40 transition-colors"
                >
                  Delete Site
                </button>
              </div>

              {/* Nested Area list */}
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
