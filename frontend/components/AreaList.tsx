"use client";

import { useState } from "react";
import { Area, createArea, deleteArea } from "../lib/api";
import { Trash2, Plus, Layers, MapPin } from "lucide-react";

interface AreaListProps {
  siteId: number;
  initialAreas: Area[];
  onAreaChanged: () => void;
}

export default function AreaList({
  siteId,
  initialAreas,
  onAreaChanged,
}: AreaListProps) {
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
    <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
          Areas & Zones ({initialAreas.length})
        </h5>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs font-semibold text-[#171717] hover:text-[#F5B82E] transition-colors flex items-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddForm ? "Cancel" : "+ Add Area"}</span>
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#F6F6F3] p-4 rounded-xl border border-[#E7E5E4] mb-4 space-y-3"
        >
          {error && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Area Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Floor 1, North Wing, Warehouse"
                className="w-full bg-white border border-[#E7E5E4] rounded-lg px-3 py-1.5 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#171717] mb-1">
                Area Type
              </label>
              <select
                value={areaType}
                onChange={(e) => setAreaType(e.target.value)}
                className="w-full bg-white border border-[#E7E5E4] rounded-lg px-3 py-1.5 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E]"
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
            <label className="block text-xs font-semibold text-[#171717] mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of work area"
              className="w-full bg-white border border-[#E7E5E4] rounded-lg px-3 py-1.5 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E]"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-xs text-[#6B7280] hover:text-[#171717]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-[#F5B82E] hover:bg-[#e0a724] disabled:opacity-50 text-[#0B0F10] rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              {loading ? "Adding..." : "Save Area"}
            </button>
          </div>
        </form>
      )}

      {initialAreas.length === 0 ? (
        <p className="text-xs text-[#6B7280] italic py-1">
          No specific areas defined for this site yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {initialAreas.map((area) => (
            <div
              key={area.id}
              className="bg-[#F6F6F3]/80 border border-[#E7E5E4] rounded-xl p-3 flex items-start justify-between group hover:border-[#F5B82E]/60 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-[#171717]">
                    {area.name}
                  </span>
                  {area.area_type && (
                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-white text-[#6B7280] rounded border border-[#E7E5E4]">
                      {area.area_type}
                    </span>
                  )}
                </div>
                {area.description && (
                  <p className="text-[11px] text-[#6B7280] mt-0.5 line-clamp-1">
                    {area.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(area.id)}
                title="Delete Area"
                className="opacity-0 group-hover:opacity-100 text-[#6B7280] hover:text-rose-600 transition-opacity p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
