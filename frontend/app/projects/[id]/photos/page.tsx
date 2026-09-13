"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  SitePhoto,
  ProjectDetail,
  Site,
  Area,
  User,
  AnalysisResult,
  FindingStatus,
  getProject,
  getSitesForProject,
  getAreasForSite,
  getProjectPhotos,
  uploadPhoto,
  deletePhoto,
  getUsers,
  analyzePhoto,
  getPhotoAnalysis,
  updateAIFindingStatus,
  bulkAnalyzePendingPhotos,
  isPPEViolation,
  isPPECompliance,
  API_BASE,
} from "../../../../lib/api";
import ProjectNav from "../../../../components/ProjectNav";
import ProjectHeader from "../../../../components/ProjectHeader";
import PPEAnalysisModal from "../../../../components/PPEAnalysisModal";
import {
  ArrowLeft,
  Camera,
  Upload,
  RotateCw,
  Building2,
  Grid,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Eye,
  Layers,
  Info,
  Sparkles,
  Zap,
  User as UserIcon,
  Calendar,
  X,
  Plus,
} from "lucide-react";

export default function ProjectPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload Form State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | "">("");
  const [selectedUploaderId, setSelectedUploaderId] = useState<number | "">("");
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dynamic Sites and Areas State for Modal
  const [sites, setSites] = useState<Site[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [areasError, setAreasError] = useState<string | null>(null);

  // AI Analysis State
  const [analyzingPhotoId, setAnalyzingPhotoId] = useState<number | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisResult | null>(null);
  const [activePhoto, setActivePhoto] = useState<SitePhoto | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [imageTab, setImageTab] = useState<"annotated" | "original">("annotated");
  const [updatingFindingId, setUpdatingFindingId] = useState<number | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const loadSites = async (projId: number) => {
    if (!projId || isNaN(projId)) return;
    setLoadingSites(true);
    setSitesError(null);
    try {
      const siteList = await getSitesForProject(projId);
      setSites(siteList);
      if (siteList.length > 0) {
        let siteToSelect = siteList[0].id;
        if (selectedSiteId !== "" && siteList.some((s) => s.id === Number(selectedSiteId))) {
          siteToSelect = Number(selectedSiteId);
        }
        setSelectedSiteId(siteToSelect);
        await loadAreas(siteToSelect);
      } else {
        setSelectedSiteId("");
        setAreas([]);
        setSelectedAreaId("");
      }
    } catch (err: any) {
      setSitesError("Failed to load construction sites. Please try again.");
      setSites([]);
      setSelectedSiteId("");
      setAreas([]);
      setSelectedAreaId("");
    } finally {
      setLoadingSites(false);
    }
  };

  const loadAreas = async (siteId: number) => {
    if (!siteId || isNaN(siteId)) {
      setAreas([]);
      setSelectedAreaId("");
      return;
    }
    setLoadingAreas(true);
    setAreasError(null);
    try {
      const areaList = await getAreasForSite(siteId);
      setAreas(areaList);
      if (selectedAreaId !== "" && !areaList.some((a) => a.id === Number(selectedAreaId))) {
        setSelectedAreaId("");
      }
    } catch (err: any) {
      setAreasError("Failed to load areas for this site. Please try again.");
      setAreas([]);
      setSelectedAreaId("");
    } finally {
      setLoadingAreas(false);
    }
  };

  const handleSiteChange = async (siteValue: string) => {
    if (!siteValue) {
      setSelectedSiteId("");
      setSelectedAreaId("");
      setAreas([]);
      setAreasError(null);
      return;
    }
    const siteId = Number(siteValue);
    setSelectedSiteId(siteId);
    setSelectedAreaId("");
    setAreas([]);
    await loadAreas(siteId);
  };

  const handleOpenUploadModal = () => {
    setFormError(null);
    setSitesError(null);
    setAreasError(null);
    setShowUploadModal(true);
    if (projectId) {
      loadSites(projectId);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, photosData, usersData, siteList] = await Promise.all([
        getProject(projectId),
        getProjectPhotos(projectId),
        getUsers(),
        getSitesForProject(projectId),
      ]);
      setProject(projData);
      setPhotos(photosData);
      setUsers(usersData);
      setSites(siteList);

      if (siteList.length > 0) {
        const initialSiteId = siteList[0].id;
        setSelectedSiteId(initialSiteId);
        const areaList = await getAreasForSite(initialSiteId).catch(() => []);
        setAreas(areaList);
      } else {
        setSelectedSiteId("");
        setAreas([]);
        setSelectedAreaId("");
      }

      if (usersData.length > 0 && selectedUploaderId === "") {
        setSelectedUploaderId(usersData[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      setSelectedSiteId("");
      setSelectedAreaId("");
      setSites([]);
      setAreas([]);
      setSitesError(null);
      setAreasError(null);
      loadData();
    }
  }, [projectId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setFormError("Please select an image file to upload");
      return;
    }
    if (!selectedSiteId) {
      setFormError("Please select a construction site");
      return;
    }
    if (!selectedUploaderId) {
      setFormError("Please select an uploader");
      return;
    }

    setUploading(true);
    setFormError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", String(projectId));
    formData.append("site_id", String(selectedSiteId));
    if (selectedAreaId) formData.append("area_id", String(selectedAreaId));
    formData.append("uploaded_by", String(selectedUploaderId));
    if (caption) formData.append("caption", caption.trim());
    if (takenAt) formData.append("taken_at", takenAt);
    if (latitude) formData.append("latitude", latitude);
    if (longitude) formData.append("longitude", longitude);

    try {
      await uploadPhoto(formData);
      setShowUploadModal(false);
      setFile(null);
      setCaption("");
      setTakenAt("");
      setLatitude("");
      setLongitude("");
      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: number) => {
    if (!confirm("Are you sure you want to delete this photo record and file?")) return;
    try {
      await deletePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err: any) {
      alert(err.message || "Failed to delete photo");
    }
  };

  const handleRunAIAnalysis = async (photo: SitePhoto, force: boolean = false) => {
    setAnalyzingPhotoId(photo.id);
    setActivePhoto(photo);
    try {
      const result = await analyzePhoto(photo.id, force);
      setActiveAnalysis(result);
      setImageTab(result.annotated_image_url ? "annotated" : "original");
      setShowAIModal(true);
    } catch (err: any) {
      alert(`AI Analysis Failed: ${err.message}`);
    } finally {
      setAnalyzingPhotoId(null);
    }
  };

  const handleOpenExistingAI = async (photo: SitePhoto) => {
    setActivePhoto(photo);
    setAnalyzingPhotoId(photo.id);
    try {
      const run = await getPhotoAnalysis(photo.id);
      setActiveAnalysis({
        photo_id: run.photo_id,
        analysis_run_id: run.id,
        status: run.status,
        model_name: run.model_name,
        model_version: run.model_version,
        processing_time_ms: run.processing_time_ms,
        detections: run.detections,
        safety_findings: run.safety_findings,
        annotated_image_url: run.annotated_file_path,
      });
      setImageTab(run.annotated_file_path ? "annotated" : "original");
      setShowAIModal(true);
    } catch {
      handleRunAIAnalysis(photo, false);
    } finally {
      setAnalyzingPhotoId(null);
    }
  };

  const handleUpdateFindingStatus = async (findingId: number, newStatus: FindingStatus) => {
    setUpdatingFindingId(findingId);
    try {
      const updated = await updateAIFindingStatus(findingId, newStatus);
      if (activeAnalysis) {
        setActiveAnalysis({
          ...activeAnalysis,
          safety_findings: activeAnalysis.safety_findings.map((f) =>
            f.id === findingId ? { ...f, status: updated.status } : f
          ),
        });
      }
    } catch (err: any) {
      alert(`Failed to update finding status: ${err.message}`);
    } finally {
      setUpdatingFindingId(null);
    }
  };

  const handleBulkAnalyze = async () => {
    setBulkAnalyzing(true);
    setBulkMessage(null);
    try {
      const res = await bulkAnalyzePendingPhotos(projectId, 20);
      setBulkMessage(`Bulk Analysis Complete: Processed ${res.processed} photo(s) (${res.successful} successful, ${res.failed} failed).`);
      setTimeout(() => setBulkMessage(null), 6000);
    } catch (err: any) {
      setBulkMessage(`Bulk analysis error: ${err.message}`);
    } finally {
      setBulkAnalyzing(false);
    }
  };

  const severityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case "HIGH":
        return "bg-rose-50 text-rose-700 border-rose-200 font-bold";
      case "MEDIUM":
        return "bg-amber-50 text-amber-800 border-amber-200 font-bold";
      case "LOW":
        return "bg-slate-100 text-slate-700 border-slate-200 font-semibold";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
    }
  };

  const statusBadge = (st: string) => {
    switch (st.toUpperCase()) {
      case "OPEN":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "REVIEWED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "RESOLVED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "FALSE_POSITIVE":
        return "bg-slate-100 text-slate-500 border-slate-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-[#171717]">
      {/* Shared Project Context Header & Stationary Navigation */}
      <ProjectHeader
        projectId={projectId}
        projectName={project?.name || `Project #${projectId}`}
        status={project?.status}
        location={project?.location}
        siteCount={sites.length}
        areaCount={areas.length}
        startDate={project?.start_date}
        endDate={project?.end_date}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleBulkAnalyze}
              disabled={bulkAnalyzing || photos.length === 0}
              className="px-4.5 py-2.5 bg-white hover:bg-slate-50 border border-[#E7E5E4] text-[#171717] text-sm font-semibold rounded-xl transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 text-[#D99A16] ${bulkAnalyzing ? "animate-spin" : ""}`} />
              <span>{bulkAnalyzing ? "Analyzing Batch..." : "Bulk Analyze Pending"}</span>
            </button>

            <button
              onClick={handleOpenUploadModal}
              className="px-5 py-2.5 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-sm font-semibold rounded-xl transition-colors shadow-xs flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Photo</span>
            </button>
          </div>
        }
      />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-1.5 pb-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] tracking-tight leading-tight">
            Site Photos
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-normal leading-relaxed">
            Capture, review and analyze visual site intelligence.
          </p>
        </div>

        {/* 2. PHOTO SUMMARY ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E7E5E4] p-5 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Photos Total</span>
              <div className="text-3xl font-black text-[#171717] mt-1">{photos.length}</div>
            </div>
            <Camera className="w-6 h-6 text-slate-400" />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-4 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">AI Vision Engine</span>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Ready
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-[#D99A16]" />
          </div>

          <div className="bg-white border border-[#E7E5E4] p-4 rounded-xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">PPE Analysis</span>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Available
              </div>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {bulkMessage && (
          <div className="p-3 bg-white border border-[#E7E5E4] text-[#171717] text-xs font-semibold rounded-xl flex items-center justify-between shadow-xs">
            <span>{bulkMessage}</span>
            <button onClick={() => setBulkMessage(null)} className="text-slate-400 hover:text-slate-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {/* 3. UPLOAD MODAL */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[#E7E5E4] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E5E4]">
                <h3 className="text-base font-bold text-[#171717] tracking-tight">Upload New Site Photo</h3>
                <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
                  {formError}
                </div>
              )}

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Image File (JPG, PNG, WEBP) *
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl p-2.5 text-xs text-slate-800 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-[#F5B82E] file:text-[#171717] hover:file:bg-[#e0a727]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Construction Site *
                    </label>
                    <select
                      value={selectedSiteId}
                      onChange={(e) => handleSiteChange(e.target.value)}
                      disabled={loadingSites || sites.length === 0}
                      className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                      required
                    >
                      {loadingSites ? (
                        <option value="">Loading sites...</option>
                      ) : sites.length === 0 ? (
                        <option value="">No construction sites found</option>
                      ) : (
                        <>
                          <option value="">Select Site</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Specific Area (Optional)
                    </label>
                    <select
                      value={selectedAreaId}
                      onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : "")}
                      disabled={!selectedSiteId || loadingAreas}
                      className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                    >
                      {loadingAreas ? (
                        <option value="">Loading areas...</option>
                      ) : !selectedSiteId ? (
                        <option value="">No Specific Area</option>
                      ) : areas.length === 0 ? (
                        <option value="">No areas available</option>
                      ) : (
                        <>
                          <option value="">No Specific Area</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Uploaded By *
                    </label>
                    <select
                      value={selectedUploaderId}
                      onChange={(e) => setSelectedUploaderId(Number(e.target.value))}
                      className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                      required
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Capture Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={takenAt}
                      onChange={(e) => setTakenAt(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs font-semibold text-[#171717] focus:outline-none focus:border-[#F5B82E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Caption / Observations
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={2}
                    placeholder="e.g. Scaffolding inspection at East elevation, worker safety harness verified"
                    className="w-full bg-[#FAF9F6] border border-[#E7E5E4] rounded-xl px-3 py-2 text-xs text-[#171717] placeholder-slate-400 focus:outline-none focus:border-[#F5B82E]"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-[#E7E5E4]">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-xs font-bold rounded-xl transition-colors shadow-xs"
                  >
                    {uploading ? "Uploading..." : "Save Photo"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. AI ANALYSIS MODAL */}
        <PPEAnalysisModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          analysis={activeAnalysis}
          photo={activePhoto}
          onReRun={() => activePhoto && handleRunAIAnalysis(activePhoto, true)}
          reRunning={analyzingPhotoId === activePhoto?.id}
        />

        {/* 5. PHOTO GALLERY GRID */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-[#E7E5E4] rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white border border-dashed border-[#E7E5E4] rounded-2xl p-12 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Camera className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#171717]">No site photos yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload visual site data to begin AI-powered inspection.
              </p>
            </div>
            <button
              onClick={handleOpenUploadModal}
              className="px-4 py-2 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-xs font-bold rounded-xl transition-colors shadow-xs inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Photo</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {photos.map((photo) => {
              const imageUrl = `${API_BASE}${photo.file_path}`;
              const isAnalyzingThis = analyzingPhotoId === photo.id;
              return (
                <div
                  key={photo.id}
                  className="bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between group hover:shadow-md transition-all duration-200"
                >
                  <div>
                    {/* Media Card Top Image */}
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={photo.caption || photo.file_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute top-2.5 right-2.5 bg-slate-900/80 text-white backdrop-blur-xs text-[10px] font-mono px-2 py-0.5 rounded-md font-bold">
                        #{photo.id}
                      </div>

                      {/* Subtle Hover Action Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2 p-4">
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white text-[#171717] font-bold text-xs rounded-lg shadow-sm hover:bg-slate-100 transition-colors inline-flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </a>
                        <button
                          onClick={() => handleOpenExistingAI(photo)}
                          className="px-3 py-1.5 bg-[#F5B82E] text-[#171717] font-bold text-xs rounded-lg shadow-sm hover:bg-[#e0a727] transition-colors inline-flex items-center space-x-1"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Analyze</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata Body */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-[#171717] line-clamp-1">
                          {photo.caption || photo.file_name}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {photo.file_name}
                        </p>
                      </div>

                      <div className="space-y-1.5 text-xs bg-[#FAF9F6] p-3 rounded-xl border border-[#E7E5E4]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-semibold">Site:</span>
                          <span className="text-slate-900 font-bold truncate max-w-[130px]">
                            {photo.site?.name || `Site #${photo.site_id}`}
                          </span>
                        </div>
                        {photo.area && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-semibold">Area:</span>
                            <span className="text-slate-900 font-bold truncate max-w-[130px]">
                              {photo.area.name}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-semibold">Uploaded:</span>
                          <span className="text-slate-700">
                            {photo.taken_at ? photo.taken_at.slice(0, 10) : photo.created_at.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 pt-0 space-y-2">
                    <button
                      onClick={() => handleOpenExistingAI(photo)}
                      disabled={isAnalyzingThis}
                      className="w-full py-2 bg-[#F5B82E] hover:bg-[#e0a727] text-[#171717] text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isAnalyzingThis ? "Analyzing..." : "Analyze with AI"}</span>
                    </button>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E7E5E4] text-slate-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        View Full
                      </a>
                      <button
                        onClick={() => handleDelete(photo.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete photo record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
