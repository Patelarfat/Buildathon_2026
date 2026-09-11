"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Material,
  MaterialStatus,
  ProjectDetail,
  User,
  getProject,
  getMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getUsers,
} from "../../../../lib/api";
import ProjectNav from "../../../../components/ProjectNav";

const STATUS_CONFIG: Record<MaterialStatus, { label: string; badge: string }> = {
  ORDERED: { label: "Ordered", badge: "bg-blue-900/30 text-blue-400 border-blue-500/30" },
  DELIVERED: { label: "Delivered On-Site", badge: "bg-emerald-900/30 text-emerald-400 border-emerald-500/30" },
  IN_USE: { label: "In Active Use", badge: "bg-purple-900/30 text-purple-400 border-purple-500/30" },
  LOW_STOCK: { label: "Low Stock Alert", badge: "bg-rose-900/40 text-rose-400 border-rose-600/40 font-bold animate-pulse" },
};

export default function MaterialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [materialName, setMaterialName] = useState("");
  const [category, setCategory] = useState("CEMENT_CONCRETE");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState("Bags");
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [recordedBy, setRecordedBy] = useState<number | "">("");
  const [status, setStatus] = useState<MaterialStatus>("DELIVERED");
  const [supplier, setSupplier] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, matsData, usersData] = await Promise.all([
        getProject(projectId),
        getMaterials(projectId),
        getUsers(),
      ]);
      setProject(projData);
      setMaterials(matsData);
      setUsers(usersData);

      if (projData.sites.length > 0 && selectedSiteId === "") {
        setSelectedSiteId(projData.sites[0].id);
      }
      if (usersData.length > 0 && recordedBy === "") {
        setRecordedBy(usersData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load materials");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName.trim() || quantity === "" || !unit.trim()) {
      setFormError("Material name, quantity, and unit are required");
      return;
    }
    if (!selectedSiteId) {
      setFormError("Please select a construction site");
      return;
    }
    if (!recordedBy) {
      setFormError("Please select who is recording the entry");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await createMaterial({
        project_id: projectId,
        site_id: Number(selectedSiteId),
        area_id: selectedAreaId ? Number(selectedAreaId) : undefined,
        recorded_by: Number(recordedBy),
        material_name: materialName.trim(),
        category: category.trim() || undefined,
        quantity: Number(quantity),
        unit: unit.trim(),
        status,
        supplier: supplier.trim() || undefined,
        delivery_date: deliveryDate || undefined,
        notes: notes.trim() || undefined,
      });

      setShowForm(false);
      setMaterialName("");
      setQuantity("");
      setSupplier("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to record material");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (matId: number, newStatus: MaterialStatus) => {
    try {
      await updateMaterial(matId, { status: newStatus });
      setMaterials((prev) =>
        prev.map((m) => (m.id === matId ? { ...m, status: newStatus } : m))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update material status");
    }
  };

  const handleDelete = async (matId: number) => {
    if (!confirm("Are you sure you want to delete this material entry?")) return;
    try {
      await deleteMaterial(matId);
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
    } catch (err: any) {
      alert(err.message || "Failed to delete material");
    }
  };

  const currentSite = project?.sites.find((s) => s.id === Number(selectedSiteId));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center space-x-2 text-xs text-slate-400">
        <Link href="/projects" className="hover:text-white">
          Projects
        </Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-white">
          {project?.name || `Project #${projectId}`}
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">Materials & Inventory</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>🧱 Materials & Site Inventory</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {materials.length} Items Logged
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track deliveries, consumption rates, vendor batches, and low stock thresholds
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 self-start sm:self-auto flex items-center space-x-2"
        >
          <span>+ Log Material Batch</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 text-sm rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl mb-8 space-y-6"
        >
          <h3 className="text-lg font-bold text-white">Record Material Inflow / Batch</h3>
          {formError && (
            <div className="p-3 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded-xl">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Material Name *
              </label>
              <input
                type="text"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="e.g. UltraTech Cement PPC 53 Grade"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="CEMENT_CONCRETE">Cement & Ready-Mix</option>
                <option value="STEEL_REBAR">Steel & Reinforcement</option>
                <option value="AGGREGATES_SAND">Aggregates & Sand</option>
                <option value="BRICKS_BLOCKS">Bricks & AAC Blocks</option>
                <option value="ELECTRICAL_PLUMBING">Electrical & Plumbing</option>
                <option value="SAFETY_GEAR">Safety Gear & PPE</option>
                <option value="OTHER">Other Consumables</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaterialStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="DELIVERED">Delivered On-Site</option>
                <option value="ORDERED">Ordered / In Transit</option>
                <option value="IN_USE">In Active Use</option>
                <option value="LOW_STOCK">Low Stock</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 500"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Unit of Measure *
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Bags, Tons, Sqm, Liters"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Supplier / Vendor
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Tata Steel / UltraTech Solapur"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Delivery Date
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Construction Site *
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => {
                  setSelectedSiteId(Number(e.target.value));
                  setSelectedAreaId("");
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              >
                <option value="">Select Site</option>
                {project?.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Allocated Area (Optional)
              </label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Yard / Central Storage</option>
                {currentSite?.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.area_type || "Zone"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Recorded By *
              </label>
              <select
                value={recordedBy}
                onChange={(e) => setRecordedBy(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                required
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Batch Notes & Specifications
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Invoice #9842, Batch A4, test certificates verified on delivery"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {submitting ? "Saving..." : "Save Material Entry"}
            </button>
          </div>
        </form>
      )}

      {/* Materials List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-3xl mb-2">🧱</div>
          <h3 className="text-base font-bold text-white mb-1">No Materials Logged</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Track material batches, deliveries, and consumption rates across project zones.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            Log First Material Batch
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {materials.map((mat) => {
            const statusConfig = STATUS_CONFIG[mat.status] || {
              label: mat.status,
              badge: "bg-slate-800 text-slate-300",
            };

            return (
              <div
                key={mat.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-base font-bold text-white">{mat.material_name}</span>
                    <span className="text-sm font-extrabold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-3 py-0.5 rounded-full">
                      {mat.quantity} {mat.unit}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusConfig.badge}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <select
                      value={mat.status}
                      onChange={(e) => handleStatusChange(mat.id, e.target.value as MaterialStatus)}
                      className="text-xs font-semibold rounded-lg px-2.5 py-1 bg-slate-950 border border-slate-700 text-white focus:outline-none"
                    >
                      <option value="DELIVERED">Delivered</option>
                      <option value="ORDERED">Ordered</option>
                      <option value="IN_USE">In Use</option>
                      <option value="LOW_STOCK">Low Stock</option>
                    </select>

                    <button
                      onClick={() => handleDelete(mat.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete Material"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                  <span>
                    📍 Location: <strong className="text-slate-300">{mat.site?.name || `Site #${mat.site_id}`}</strong>
                    {mat.area && ` (${mat.area.name})`}
                  </span>
                  {mat.supplier && (
                    <span>
                      🏢 Supplier: <strong className="text-slate-300">{mat.supplier}</strong>
                    </span>
                  )}
                  {mat.delivery_date && (
                    <span>
                      📅 Delivery: <strong className="text-slate-300">{mat.delivery_date}</strong>
                    </span>
                  )}
                </div>

                {mat.notes && (
                  <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    {mat.notes}
                  </p>
                )}

                <div className="text-[11px] text-slate-500 pt-1">
                  Recorded by: {mat.recorder?.name || `User #${mat.recorded_by}`} on{" "}
                  {mat.created_at.slice(0, 10)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
