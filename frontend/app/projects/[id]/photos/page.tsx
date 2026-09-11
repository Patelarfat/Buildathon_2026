"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  SitePhoto,
  ProjectDetail,
  User,
  AnalysisResult,
  AISafetyFinding,
  FindingStatus,
  getProject,
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

  // AI Analysis State
  const [analyzingPhotoId, setAnalyzingPhotoId] = useState<number | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisResult | null>(null);
  const [activePhoto, setActivePhoto] = useState<SitePhoto | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [imageTab, setImageTab] = useState<"annotated" | "original">("annotated");
  const [updatingFindingId, setUpdatingFindingId] = useState<number | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projData, photosData, usersData] = await Promise.all([
        getProject(projectId),
        getProjectPhotos(projectId),
        getUsers(),
      ]);
      setProject(projData);
      setPhotos(photosData);
      setUsers(usersData);

      if (projData.sites.length > 0 && selectedSiteId === "") {
        setSelectedSiteId(projData.sites[0].id);
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
      // If no analysis exists yet, run it
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

  const currentSite = project?.sites.find((s) => s.id === Number(selectedSiteId));

  const severityBadge = (sev: string) => {
    switch (sev.toUpperCase()) {
      case "HIGH":
        return "bg-rose-950/60 text-rose-300 border-rose-800/80";
      case "MEDIUM":
        return "bg-amber-950/60 text-amber-300 border-amber-800/80";
      case "LOW":
        return "bg-blue-950/60 text-blue-300 border-blue-800/80";
      default:
        return "bg-emerald-950/60 text-emerald-300 border-emerald-800/80";
    }
  };

  const statusBadge = (st: string) => {
    switch (st.toUpperCase()) {
      case "OPEN":
        return "bg-rose-900/40 text-rose-300 border-rose-700";
      case "REVIEWED":
        return "bg-blue-900/40 text-blue-300 border-blue-700";
      case "RESOLVED":
        return "bg-emerald-900/40 text-emerald-300 border-emerald-700";
      case "FALSE_POSITIVE":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

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
        <span className="text-slate-200 font-medium">Site Photos & PPE Vision</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>📸 Site Evidence & PPE Vision</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {photos.length} Photos
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual inspection captures powered by Ultralytics Construction-PPE YOLO fine-tuned model
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleBulkAnalyze}
            disabled={bulkAnalyzing || photos.length === 0}
            className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 text-xs font-semibold rounded-xl transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <span>⚡</span>
            <span>{bulkAnalyzing ? "Analyzing Batch..." : "Bulk Analyze Pending"}</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center space-x-1.5"
          >
            <span>+</span>
            <span>Upload Photo</span>
          </button>
        </div>
      </div>

      {bulkMessage && (
        <div className="p-3 bg-indigo-950/50 border border-indigo-800 text-indigo-200 text-xs rounded-xl mb-6 flex items-center justify-between">
          <span>{bulkMessage}</span>
          <button onClick={() => setBulkMessage(null)} className="text-indigo-400 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 text-sm rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Upload New Site Photo</h3>
            {formError && (
              <div className="p-2.5 bg-rose-900/30 border border-rose-800 text-rose-300 text-xs rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Image File (JPG, PNG, WEBP) *
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    Specific Area (Optional)
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={(e) => setSelectedAreaId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">No Specific Area</option>
                    {currentSite?.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.area_type || "Zone"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Uploaded By *
                  </label>
                  <select
                    value={selectedUploaderId}
                    onChange={(e) => setSelectedUploaderId(Number(e.target.value))}
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

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Capture Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={takenAt}
                    onChange={(e) => setTakenAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Caption / Observations
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={2}
                  placeholder="e.g. Scaffolding inspection at East elevation, worker safety harness verified"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Latitude (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="e.g. 17.6599"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Longitude (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="e.g. 75.9064"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {uploading ? "Uploading..." : "Save Photo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAIModal && activeAnalysis && activePhoto && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <span>⚡ AI Computer Vision PPE Analysis</span>
                  </h3>
                  <span className="text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full font-medium">
                    {activeAnalysis.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Model: <span className="text-slate-200 font-mono">{activeAnalysis.model_name} ({activeAnalysis.model_version})</span> · Execution: <span className="text-blue-400 font-medium">{activeAnalysis.processing_time_ms ?? 0} ms</span>
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleRunAIAnalysis(activePhoto, true)}
                  disabled={analyzingPhotoId === activePhoto.id}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                >
                  🔄 Re-run Analysis
                </button>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Image Viewer with Tabs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setImageTab("annotated")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      imageTab === "annotated"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    🎯 AI Annotated Boxes ({activeAnalysis.detections.length})
                  </button>
                  <button
                    onClick={() => setImageTab("original")}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      imageTab === "original"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-950 text-slate-400 hover:text-white"
                    }`}
                  >
                    Original Photo
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">
                  {activePhoto.file_name}
                </span>
              </div>

              <div className="relative bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-center justify-center min-h-[320px] max-h-[480px] overflow-hidden">
                {imageTab === "annotated" && activeAnalysis.annotated_image_url ? (
                  <img
                    src={`${API_BASE}${activeAnalysis.annotated_image_url}`}
                    alt="AI Annotated"
                    className="max-h-[460px] w-auto object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={`${API_BASE}${activePhoto.file_path}`}
                    alt="Original"
                    className="max-h-[460px] w-auto object-contain rounded-lg"
                  />
                )}
              </div>
            </div>

            {/* Detections Pill List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Detected Objects ({activeAnalysis.detections.length})
              </h4>
              {activeAnalysis.detections.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No PPE objects detected above confidence threshold.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeAnalysis.detections.map((det, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs flex items-center space-x-2"
                    >
                      <span className="font-semibold text-white">{det.class_name}</span>
                      <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-900 px-1.5 py-0.2 rounded">
                        {Math.round(det.confidence * 100)}% conf
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PPE Semantic Interpretation */}
            {(() => {
              const complianceFindings = activeAnalysis.safety_findings.filter(isPPECompliance);
              const violationFindings = activeAnalysis.safety_findings.filter(isPPEViolation);

              return (
                <div className="space-y-6 pt-2 border-t border-slate-800">
                  {/* Section A: PPE Compliance Confirmations */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-2">
                        <span>🟢 PPE Compliance ({complianceFindings.length})</span>
                      </h4>
                      <span className="text-[11px] text-emerald-500/80 font-medium">Safe & Verified Equipment</span>
                    </div>

                    {complianceFindings.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2 bg-slate-950/40 border border-slate-800/60 rounded-xl px-4">
                        No compliant PPE equipment verified in this frame.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {complianceFindings.map((cf) => (
                          <div
                            key={cf.id}
                            className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl flex items-start justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-emerald-400 font-bold text-sm">✓</span>
                                <span className="text-xs font-bold text-white">{cf.title}</span>
                              </div>
                              {cf.description && (
                                <p className="text-xs text-slate-400">{cf.description}</p>
                              )}
                              <p className="text-[11px] text-slate-500">
                                Type: <span className="font-mono text-emerald-300/80">{cf.finding_type}</span> · Confidence: <span className="text-emerald-400 font-medium">{Math.round(cf.confidence * 100)}%</span>
                              </p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-emerald-950/60 text-emerald-300 border-emerald-800/80 shrink-0">
                              VERIFIED
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section B: AI Safety Violations & Human Review */}
                  <div className="space-y-3 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-2">
                        <span>⚠️ AI Safety Violations ({violationFindings.length})</span>
                      </h4>
                      <span className="text-[11px] text-slate-500">Human-in-the-loop review required</span>
                    </div>

                    {violationFindings.length === 0 ? (
                      <div className="p-3.5 bg-emerald-950/30 border border-emerald-900/50 rounded-xl flex items-center space-x-2.5 text-emerald-400 text-xs">
                        <span className="text-base font-bold">✓</span>
                        <span className="font-semibold">No PPE safety violations detected.</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {violationFindings.map((finding) => (
                          <div
                            key={finding.id}
                            className="bg-slate-950/80 border border-rose-900/30 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-rose-800/50 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityBadge(finding.severity)}`}>
                                  {finding.severity}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusBadge(finding.status)}`}>
                                  {finding.status}
                                </span>
                                <span className="text-xs font-bold text-white">{finding.title}</span>
                              </div>
                              {finding.description && (
                                <p className="text-xs text-slate-400">{finding.description}</p>
                              )}
                              <p className="text-[11px] text-slate-500">
                                Finding Type: <span className="font-mono text-slate-400">{finding.finding_type}</span> · Confidence: <span className="text-rose-400 font-medium">{Math.round(finding.confidence * 100)}%</span>
                              </p>
                            </div>

                            {/* Human Review Actions */}
                            <div className="flex items-center space-x-1.5 shrink-0">
                              <button
                                onClick={() => handleUpdateFindingStatus(finding.id, "REVIEWED")}
                                disabled={updatingFindingId === finding.id || finding.status === "REVIEWED"}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 border border-blue-800/60 rounded-lg transition-colors disabled:opacity-40"
                              >
                                Mark Reviewed
                              </button>
                              <button
                                onClick={() => handleUpdateFindingStatus(finding.id, "RESOLVED")}
                                disabled={updatingFindingId === finding.id || finding.status === "RESOLVED"}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg transition-colors disabled:opacity-40"
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => handleUpdateFindingStatus(finding.id, "FALSE_POSITIVE")}
                                disabled={updatingFindingId === finding.id || finding.status === "FALSE_POSITIVE"}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 rounded-lg transition-colors disabled:opacity-40"
                              >
                                False Positive
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Photos Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-64 animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-8">
          <div className="text-3xl mb-2">📸</div>
          <h3 className="text-base font-bold text-white mb-1">No Site Photos Recorded</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Upload field photos with timestamps, location, and area tags for AI inspection and audit.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
          >
            Upload First Photo
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
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between group hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="relative h-48 bg-slate-950 flex items-center justify-center overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={photo.caption || photo.file_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">
                      ID #{photo.id}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    {photo.caption && (
                      <p className="text-xs font-medium text-white line-clamp-2">
                        {photo.caption}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 truncate" title={photo.file_name}>
                      📄 {photo.file_name}
                    </p>

                    <div className="space-y-1 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Site:</span>
                        <span className="text-slate-200 font-medium truncate max-w-[140px]">
                          {photo.site?.name || `Site #${photo.site_id}`}
                        </span>
                      </div>
                      {photo.area && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Area:</span>
                          <span className="text-blue-400 font-medium truncate max-w-[140px]">
                            {photo.area.name}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Uploader:</span>
                        <span className="text-slate-300">
                          {photo.uploader?.name || `User #${photo.uploaded_by}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Date:</span>
                        <span className="text-slate-300">
                          {photo.taken_at || photo.created_at.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 space-y-2">
                  <button
                    onClick={() => handleOpenExistingAI(photo)}
                    disabled={isAnalyzingThis}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <span>⚡</span>
                    <span>{isAnalyzingThis ? "Analyzing..." : "Analyze with AI"}</span>
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                    >
                      View Full
                    </a>
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="py-1.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
