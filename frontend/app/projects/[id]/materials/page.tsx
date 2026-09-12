"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Package,
  Boxes,
  Warehouse,
  Truck,
  Layers,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  Building2,
  UserCheck,
  Calendar,
  ChevronRight,
  RefreshCw,
  X,
  Sparkles,
  Filter,
} from "lucide-react";
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
import ProjectNav from "@/components/ProjectNav";
import ProjectHeader from "@/components/ProjectHeader";

const STATUS_CONFIG: Record<
  MaterialStatus,
  { label: string; badge: string; icon: React.ElementType }
> = {
  ORDERED: {
    label: "Ordered / In Transit",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  DELIVERED: {
    label: "Delivered On-Site",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  IN_USE: {
    label: "In Active Use",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200 font-medium",
    icon: Layers,
  },
  LOW_STOCK: {
    label: "Low Stock Alert",
    badge: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
    icon: AlertTriangle,
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  CEMENT_CONCRETE: "Cement & Ready-Mix",
  STEEL_REBAR: "Steel & Reinforcement",
  AGGREGATES_SAND: "Aggregates & Sand",
  BRICKS_BLOCKS: "Bricks & AAC Blocks",
  ELECTRICAL_PLUMBING: "Electrical & Plumbing",
  SAFETY_GEAR: "Safety Gear & PPE",
  OTHER: "Other Consumables",
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

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Form / Modal State
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
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
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

  const handleStatusChange = async (
    matId: number,
    newStatus: MaterialStatus
  ) => {
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
    if (!confirm("Are you sure you want to delete this material entry?"))
      return;
    try {
      await deleteMaterial(matId);
      setMaterials((prev) => prev.filter((m) => m.id !== matId));
    } catch (err: any) {
      alert(err.message || "Failed to delete material");
    }
  };

  const currentSite = project?.sites.find(
    (s) => s.id === Number(selectedSiteId)
  );

  // Summary Metrics calculations
  const totalCount = materials.length;
  const inStockCount = materials.filter(
    (m) => m.status === "DELIVERED" || m.status === "IN_USE"
  ).length;
  const lowStockCount = materials.filter(
    (m) => m.status === "LOW_STOCK"
  ).length;
  const pendingCount = materials.filter((m) => m.status === "ORDERED").length;

  // Filtered list
  const filteredMaterials = materials.filter((mat) => {
    if (
      statusFilter === "IN_STOCK" &&
      mat.status !== "DELIVERED" &&
      mat.status !== "IN_USE"
    )
      return false;
    if (statusFilter === "LOW_STOCK" && mat.status !== "LOW_STOCK")
      return false;
    if (statusFilter === "ORDERED" && mat.status !== "ORDERED") return false;

    if (categoryFilter !== "ALL" && mat.category !== categoryFilter)
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = mat.material_name.toLowerCase().includes(q);
      const matchSupplier = mat.supplier?.toLowerCase().includes(q);
      const matchSite = mat.site?.name?.toLowerCase().includes(q);
      const matchCategory = mat.category?.toLowerCase().includes(q);
      const matchNotes = mat.notes?.toLowerCase().includes(q);
      return matchName || matchSupplier || matchSite || matchCategory || matchNotes;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#171717] font-sans antialiased pb-16">
      {/* Shared Project Context Header & Stationary Navigation */}
      <ProjectHeader
        projectId={projectId}
        projectName={project?.name || `Project #${projectId}`}
        status={project?.status}
        location={project?.location}
        siteCount={project?.sites?.length}
        areaCount={project?.sites?.reduce((acc, s) => acc + (s.areas?.length || 0), 0)}
        startDate={project?.start_date}
        endDate={project?.end_date}
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Log Material Batch</span>
          </button>
        }
      />

      {/* Main Container */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight flex items-center gap-3">
            <span>Materials & Inventory</span>
            <span className="text-xs bg-[#0B0F10] text-[#F5B82E] font-semibold px-2.5 py-0.5 rounded-full">
              {totalCount} Items
            </span>
          </h1>
          <p className="text-sm sm:text-base text-[#6B7280] font-normal leading-relaxed">
            Track material deliveries, stock levels, consumption, and procurement activity across your sites.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="text-xs font-semibold text-rose-700 hover:underline flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              <span>TOTAL MATERIALS</span>
              <Package className="w-4 h-4 text-[#6B7280]" />
            </div>
            <div className="text-3xl font-black text-[#171717]">{totalCount}</div>
            <div className="text-xs text-[#6B7280]">Tracked batches & SKUs</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>IN STOCK</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900">{inStockCount}</div>
            <div className="text-[11px] text-emerald-700/80">Delivered & in active use</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
              <span>LOW STOCK</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-900">{lowStockCount}</div>
            <div className="text-[11px] text-rose-700/80">Requires reorder</div>
          </div>

          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
              <span>PENDING DELIVERIES</span>
              <Truck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">{pendingCount}</div>
            <div className="text-[11px] text-amber-700/80">Ordered / In transit</div>
          </div>
        </div>

        {/* Inventory Health Indicator Banner */}
        {totalCount > 0 && (
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#F5B82E] border border-amber-200 flex items-center justify-center flex-shrink-0">
                <Warehouse className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                  INVENTORY HEALTH & SUPPLY CHAIN STATUS
                </span>
                <p className="text-xs text-[#171717] font-medium mt-0.5">
                  {lowStockCount > 0
                    ? `Attention required: ${lowStockCount} material batch(es) flagged with low stock level alerts.`
                    : pendingCount > 0
                    ? `Supply in progress: ${pendingCount} material order(s) expected for site delivery.`
                    : "Site inventory is currently healthy with all primary materials adequately stocked."}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-[#6B7280]">
              <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
              <span>Real-time Stock Tracking</span>
            </div>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-[#E7E5E4] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search materials, batches or vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl pl-9 pr-4 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E] transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-[#F6F6F3] p-1 rounded-xl border border-[#E7E5E4] text-xs">
              {[
                { id: "ALL", label: "All" },
                { id: "IN_STOCK", label: "In Stock" },
                { id: "LOW_STOCK", label: "Low Stock" },
                { id: "ORDERED", label: "Pending" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === tab.id
                      ? "bg-white text-[#171717] shadow-sm font-semibold"
                      : "text-[#6B7280] hover:text-[#171717]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#F5B82E] font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="CEMENT_CONCRETE">Cement & Ready-Mix</option>
              <option value="STEEL_REBAR">Steel & Reinforcement</option>
              <option value="AGGREGATES_SAND">Aggregates & Sand</option>
              <option value="BRICKS_BLOCKS">Bricks & AAC Blocks</option>
              <option value="ELECTRICAL_PLUMBING">Electrical & Plumbing</option>
              <option value="SAFETY_GEAR">Safety Gear & PPE</option>
              <option value="OTHER">Other Consumables</option>
            </select>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#E7E5E4] rounded-2xl h-24 animate-pulse"
              />
            ))}
          </div>
        ) : filteredMaterials.length === 0 ? (
          /* Premium Compact White Empty State */
          <div className="bg-white border border-[#E7E5E4] rounded-2xl p-8 sm:p-10 text-center max-w-lg mx-auto shadow-sm space-y-4 my-6">
            <div className="w-14 h-14 bg-amber-50 text-[#F5B82E] border border-amber-200/60 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Boxes className="w-7 h-7 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#171717]">
                {searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL"
                  ? "No matching materials found"
                  : "No Materials Logged"}
              </h3>
              <p className="text-xs text-[#6B7280] leading-relaxed max-w-sm mx-auto">
                {searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL"
                  ? "Try resetting your search query or status filters."
                  : "Track deliveries, stock levels, vendors, and material consumption from one workspace."}
              </p>
            </div>

            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setCategoryFilter("ALL");
                  setShowForm(true);
                }}
                className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] text-[#0B0F10] font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Log First Material Batch</span>
              </button>

              <span className="text-[11px] text-[#6B7280]">
                Your material records will appear here once a batch is logged.
              </span>
            </div>
          </div>
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-[#E7E5E4] rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F6F6F3] border-b border-[#E7E5E4] text-[#6B7280] font-semibold uppercase tracking-wider">
                    <th className="py-3.5 px-5">Material & Category</th>
                    <th className="py-3.5 px-4">Location / Site</th>
                    <th className="py-3.5 px-4">Quantity & Unit</th>
                    <th className="py-3.5 px-4">Supplier / Vendor</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Delivery / Date</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {filteredMaterials.map((mat) => {
                    const statusCfg =
                      STATUS_CONFIG[mat.status] || STATUS_CONFIG.DELIVERED;
                    const StatusIcon = statusCfg.icon;

                    return (
                      <tr
                        key={mat.id}
                        className="hover:bg-[#FAF9F6] transition-colors group"
                      >
                        {/* Name & Category */}
                        <td className="py-4 px-5">
                          <div className="font-bold text-[#171717] text-sm">
                            {mat.material_name}
                          </div>
                          <div className="text-[11px] text-[#6B7280] flex items-center space-x-1 mt-0.5">
                            <Layers className="w-3 h-3 text-[#6B7280]" />
                            <span>
                              {CATEGORY_LABELS[mat.category || "OTHER"] ||
                                mat.category ||
                                "General"}
                            </span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-4 px-4 text-[#171717]">
                          <div className="flex items-center space-x-1 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-[#6B7280]" />
                            <span>{mat.site?.name || `Site #${mat.site_id}`}</span>
                          </div>
                          {mat.area && (
                            <div className="text-[11px] text-[#6B7280] ml-4">
                              Zone: {mat.area.name}
                            </div>
                          )}
                        </td>

                        {/* Quantity */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center font-bold text-sm text-[#171717] bg-[#F6F6F3] border border-[#E7E5E4] px-2.5 py-1 rounded-lg">
                            {mat.quantity}{" "}
                            <span className="text-xs font-normal text-[#6B7280] ml-1">
                              {mat.unit}
                            </span>
                          </span>
                        </td>

                        {/* Supplier */}
                        <td className="py-4 px-4 text-[#171717]">
                          {mat.supplier ? (
                            <span className="font-medium">{mat.supplier}</span>
                          ) : (
                            <span className="text-[#6B7280] italic">
                              Unspecified
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full border font-semibold inline-flex items-center space-x-1.5 ${statusCfg.badge}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{statusCfg.label}</span>
                          </span>
                        </td>

                        {/* Date & Recorded By */}
                        <td className="py-4 px-4 text-[11px] text-[#6B7280]">
                          <div>
                            {mat.delivery_date ? (
                              <span>Delivery: {mat.delivery_date}</span>
                            ) : (
                              <span>Logged: {mat.created_at.slice(0, 10)}</span>
                            )}
                          </div>
                          <div className="text-[#6B7280]">
                            By: {mat.recorder?.name || `User #${mat.recorded_by}`}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <select
                              value={mat.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  mat.id,
                                  e.target.value as MaterialStatus
                                )
                              }
                              className="text-xs font-semibold rounded-xl px-2 py-1 bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                            >
                              <option value="DELIVERED">Delivered</option>
                              <option value="ORDERED">Ordered</option>
                              <option value="IN_USE">In Use</option>
                              <option value="LOW_STOCK">Low Stock</option>
                            </select>

                            <button
                              onClick={() => handleDelete(mat.id)}
                              className="p-1.5 text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Material Entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden space-y-4">
              {filteredMaterials.map((mat) => {
                const statusCfg =
                  STATUS_CONFIG[mat.status] || STATUS_CONFIG.DELIVERED;
                const StatusIcon = statusCfg.icon;

                return (
                  <div
                    key={mat.id}
                    className="bg-white border border-[#E7E5E4] rounded-2xl p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E7E5E4]">
                      <div>
                        <h3 className="font-bold text-[#171717] text-base">
                          {mat.material_name}
                        </h3>
                        <span className="text-xs text-[#6B7280]">
                          {CATEGORY_LABELS[mat.category || "OTHER"] ||
                            mat.category}
                        </span>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-1 rounded-full border font-semibold inline-flex items-center space-x-1 ${statusCfg.badge}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#F6F6F3] p-2.5 rounded-xl border border-[#E7E5E4]">
                        <span className="text-[#6B7280] block text-[11px]">
                          Quantity
                        </span>
                        <span className="font-bold text-[#171717] text-sm">
                          {mat.quantity} {mat.unit}
                        </span>
                      </div>

                      <div className="bg-[#F6F6F3] p-2.5 rounded-xl border border-[#E7E5E4]">
                        <span className="text-[#6B7280] block text-[11px]">
                          Location
                        </span>
                        <span className="font-semibold text-[#171717]">
                          {mat.site?.name || `Site #${mat.site_id}`}
                        </span>
                      </div>
                    </div>

                    {mat.notes && (
                      <p className="text-xs text-[#171717] bg-[#F6F6F3] p-2.5 rounded-xl border border-[#E7E5E4]">
                        {mat.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 text-xs border-t border-[#E7E5E4]">
                      <select
                        value={mat.status}
                        onChange={(e) =>
                          handleStatusChange(
                            mat.id,
                            e.target.value as MaterialStatus
                          )
                        }
                        className="text-xs font-semibold rounded-xl px-2 py-1 bg-[#F6F6F3] border border-[#E7E5E4] text-[#171717]"
                      >
                        <option value="DELIVERED">Delivered</option>
                        <option value="ORDERED">Ordered</option>
                        <option value="IN_USE">In Use</option>
                        <option value="LOW_STOCK">Low Stock</option>
                      </select>

                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="p-1.5 text-rose-600 rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Log Material Batch Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F10]/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E7E5E4] rounded-2xl w-full max-w-2xl shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E4]">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#F5B82E] border border-amber-200 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#171717]">
                    Record Material Inflow / Batch
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Log raw materials, vendor deliveries, or equipment allocations.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-[#6B7280] hover:text-[#171717] p-1.5 rounded-lg hover:bg-[#F6F6F3] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Material Name *
                  </label>
                  <input
                    type="text"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    placeholder="e.g. UltraTech Cement PPC 53 Grade"
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  >
                    <option value="CEMENT_CONCRETE">Cement & Ready-Mix</option>
                    <option value="STEEL_REBAR">Steel & Reinforcement</option>
                    <option value="AGGREGATES_SAND">Aggregates & Sand</option>
                    <option value="BRICKS_BLOCKS">Bricks & AAC Blocks</option>
                    <option value="ELECTRICAL_PLUMBING">
                      Electrical & Plumbing
                    </option>
                    <option value="SAFETY_GEAR">Safety Gear & PPE</option>
                    <option value="OTHER">Other Consumables</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Status *
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as MaterialStatus)
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
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
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="e.g. 500"
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Unit of Measure *
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. Bags, Tons, Sqm, Liters"
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Supplier / Vendor
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. Tata Steel / UltraTech Solapur"
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Construction Site *
                  </label>
                  <select
                    value={selectedSiteId}
                    onChange={(e) => {
                      setSelectedSiteId(Number(e.target.value));
                      setSelectedAreaId("");
                    }}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
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
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Allocated Area (Optional)
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) =>
                      setSelectedAreaId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
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
                  <label className="block text-xs font-semibold text-[#171717] mb-1">
                    Recorded By *
                  </label>
                  <select
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(Number(e.target.value))}
                    className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
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
                <label className="block text-xs font-semibold text-[#171717] mb-1">
                  Batch Notes & Specifications
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Invoice #9842, Batch A4, test certificates verified on delivery"
                  className="w-full bg-[#F6F6F3] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-[#6B7280] focus:outline-none focus:border-[#F5B82E] focus:ring-1 focus:ring-[#F5B82E]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#E7E5E4]">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#171717] rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a724] disabled:opacity-50 text-[#0B0F10] text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  {submitting ? "Saving..." : "Save Material Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
