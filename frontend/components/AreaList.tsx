"use client";

import { useState } from "react";
import { Area, createArea, deleteArea } from "../lib/api";

interface AreaListProps {
  siteId: number;
  initialAreas: Area[];
  onAreaChanged: () => void;
}

export default function AreaList({ siteId, initialAreas, onAreaChanged }: AreaListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [areaType, setAreaType] = useState("FLOOR");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Area name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createArea(siteId, {
        name: name.trim(),
        area_type: areaType,
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setShowAddForm(false);
      onAreaChanged();
    } catch (err: any) {
      setError(err.message || "Failed to create area");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (areaId: number) => {
    if (!confirm("Are you sure you want to delete this area?")) return;
    try {
      await deleteArea(areaId);
      onAreaChanged();
    } catch (err: any) {
      alert(err.message || "Failed to delete area");
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-800/80">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Areas / Zones ({initialAreas.length})
        </h5>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline"
        >
          {showAddForm ? "Cancel" : "+ Add Area"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-4 space-y-3"
        >
          {error && (
            <div className="p-2 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Area Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Floor 1, North Wing, Warehouse"
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Area Type
              </label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="FLOOR">Floor</option>
                <option value="BUILDING">Building</option>
                <option value="WING">Wing</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="FOUNDATION">Foundation</option>
                <option value="ROOF">Roof / Terrace</option>
                <option value="OUTDOOR">Outdoor / Yard</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of work area"
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded text-xs font-medium transition-colors"
            >
              {loading ? "Adding..." : "Save Area"}
            </button>
          </div>
        </form>
      )}

      {initialAreas.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2">
          No areas defined for this site yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {initialAreas.map((area) => (
            <div
              key={area.id}
              className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex items-start justify-between group hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-xs text-white">
                    {area.name}
                  </span>
                  {area.area_type && (
                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {area.area_type}
                    </span>
                  )}
                </div>
                {area.description && (
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {area.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(area.id)}
                title="Delete Area"
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-1"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
