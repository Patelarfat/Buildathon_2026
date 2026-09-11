"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  SitePhoto,
  ProjectDetail,
  User,
  getProject,
  getProjectPhotos,
  uploadPhoto,
  deletePhoto,
  getUsers,
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
        <span className="text-slate-200 font-medium">Site Photos</span>
      </div>

      <ProjectNav projectId={projectId} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
            <span>📸 Site Evidence & Photos</span>
            <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
              {photos.length} Photos
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual inspection captures and area progress evidence traceable to sites and work zones
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/30 self-start sm:self-auto flex items-center space-x-2"
        >
          <span>+ Upload Site Photo</span>
        </button>
      </div>

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

                <div className="p-4 pt-0 flex items-center justify-between gap-2">
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
            );
          })}
        </div>
      )}
    </main>
  );
}
