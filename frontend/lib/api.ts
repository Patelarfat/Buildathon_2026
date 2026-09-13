export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// --- Types ---
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

export type ProjectRole =
  | "PROJECT_MANAGER"
  | "SITE_SUPERVISOR"
  | "SAFETY_OFFICER"
  | "CONTRACTOR"
  | "ADMIN";

export type IncidentType =
  | "PPE_VIOLATION"
  | "FALL"
  | "INJURY"
  | "EQUIPMENT_ACCIDENT"
  | "UNSAFE_BEHAVIOR"
  | "UNSAFE_CONDITION"
  | "OTHER";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type IncidentStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED";

export type InspectionType =
  | "SAFETY"
  | "QUALITY"
  | "EQUIPMENT"
  | "ENVIRONMENTAL"
  | "GENERAL";

export type InspectionStatus =
  | "OPEN"
  | "PASSED"
  | "FAILED"
  | "REQUIRES_ACTION";

export type ObservationType =
  | "PROGRESS"
  | "SAFETY"
  | "QUALITY"
  | "MATERIAL"
  | "EQUIPMENT"
  | "GENERAL";

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH";

export type ObservationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type MaterialStatus =
  | "ORDERED"
  | "DELIVERED"
  | "IN_USE"
  | "LOW_STOCK";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Area {
  id: number;
  site_id: number;
  name: string;
  area_type?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: number;
  project_id: number;
  name: string;
  address?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  areas: Area[];
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: ProjectRole;
  joined_at: string;
  user?: User;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  location?: string | null;
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  sites: Site[];
  members: ProjectMember[];
}

// --- Phase 3 Entities ---
export interface SitePhoto {
  id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  uploaded_by: number;
  file_name: string;
  file_path: string;
  caption?: string | null;
  taken_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
  uploader?: User | null;
  site?: Site | null;
  area?: Area | null;
}

export interface DailyReport {
  id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  reported_by: number;
  report_date: string;
  work_completed?: string | null;
  work_planned?: string | null;
  progress_percentage?: number | null;
  workers_count?: number | null;
  weather?: string | null;
  equipment_used?: string | null;
  materials_used?: string | null;
  issues?: string | null;
  blockers?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  reporter?: User | null;
  site?: Site | null;
  area?: Area | null;
}

export interface SafetyIncident {
  id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  reported_by: number;
  incident_date: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  action_taken?: string | null;
  status: IncidentStatus;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  reporter?: User | null;
  site?: Site | null;
  area?: Area | null;
}

export interface InspectionReport {
  id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  inspector_id: number;
  inspection_date: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  findings?: string | null;
  recommendations?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  inspector?: User | null;
  site?: Site | null;
  area?: Area | null;
}

export interface Observation {
  id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  created_by: number;
  observation_type: ObservationType;
  title: string;
  description: string;
  priority: PriorityLevel;
  status: ObservationStatus;
  assigned_to?: number | null;
  observed_at?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  creator?: User | null;
  assignee?: User | null;
  site?: Site | null;
  area?: Area | null;
}

export interface Material {
  id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  recorded_by: number;
  material_name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  status: MaterialStatus;
  supplier?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  recorder?: User | null;
  site?: Site | null;
  area?: Area | null;
}

export interface ActivityItem {
  id: number;
  type: "PHOTO" | "REPORT" | "INCIDENT" | "INSPECTION" | "OBSERVATION" | "MATERIAL";
  title: string;
  description?: string | null;
  status?: string | null;
  severity_or_priority?: string | null;
  site_name?: string | null;
  area_name?: string | null;
  user_name?: string | null;
  date: string;
  created_at: string;
}

// Generic API caller with comprehensive error handling
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const isFormData = options?.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...((options?.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.detail) {
          if (typeof errJson.detail === "string") {
            errorMsg = errJson.detail;
          } else if (Array.isArray(errJson.detail)) {
            errorMsg = errJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
          }
        }
      } catch {}
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error("Unable to connect to backend server. Make sure FastAPI is running on port 8000.");
    }
    throw err;
  }
}

// --- Project API ---
export const getProjects = () => request<Project[]>("/api/projects");
export const getProject = (id: number) => request<ProjectDetail>(`/api/projects/${id}`);
export const createProject = (data: Partial<Project>) =>
  request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: number, data: Partial<Project>) =>
  request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteProject = (id: number) =>
  request<{ message: string }>(`/api/projects/${id}`, { method: "DELETE" });
export const getProjectActivity = (projectId: number) =>
  request<ActivityItem[]>(`/api/projects/${projectId}/activity`);

// --- Site API ---
export const getSitesForProject = (projectId: number) =>
  request<Site[]>(`/api/projects/${projectId}/sites`);
export const createSite = (projectId: number, data: { name: string; address?: string; description?: string }) =>
  request<Site>(`/api/projects/${projectId}/sites`, { method: "POST", body: JSON.stringify(data) });
export const getSite = (siteId: number) => request<Site>(`/api/sites/${siteId}`);
export const updateSite = (siteId: number, data: { name?: string; address?: string; description?: string }) =>
  request<Site>(`/api/sites/${siteId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSite = (siteId: number) =>
  request<{ message: string }>(`/api/sites/${siteId}`, { method: "DELETE" });

// --- Area API ---
export const getAreasForSite = (siteId: number) =>
  request<Area[]>(`/api/sites/${siteId}/areas`);
export const createArea = (siteId: number, data: { name: string; area_type?: string; description?: string }) =>
  request<Area>(`/api/sites/${siteId}/areas`, { method: "POST", body: JSON.stringify(data) });
export const getArea = (areaId: number) => request<Area>(`/api/areas/${areaId}`);
export const updateArea = (areaId: number, data: { name?: string; area_type?: string; description?: string }) =>
  request<Area>(`/api/areas/${areaId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteArea = (areaId: number) =>
  request<{ message: string }>(`/api/areas/${areaId}`, { method: "DELETE" });

// --- Member API ---
export const getProjectMembers = (projectId: number) =>
  request<ProjectMember[]>(`/api/projects/${projectId}/members`);
export const addProjectMember = (projectId: number, data: { user_id: number; role: ProjectRole }) =>
  request<ProjectMember>(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(data) });
export const updateProjectMemberRole = (projectId: number, userId: number, data: { role: ProjectRole }) =>
  request<ProjectMember>(`/api/projects/${projectId}/members/${userId}`, { method: "PUT", body: JSON.stringify(data) });
export const removeProjectMember = (projectId: number, userId: number) =>
  request<{ message: string }>(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });

// --- Users API ---
export const getUsers = () => request<User[]>("/api/users");
export const createUser = (data: { name: string; email: string; role: string; password?: string }) =>
  request<User>("/api/users", { method: "POST", body: JSON.stringify(data) });

// --- Phase 3: Field Data API ---

// Photos
export const uploadPhoto = (formData: FormData) =>
  request<SitePhoto>("/api/photos", { method: "POST", body: formData });
export const getProjectPhotos = (projectId: number) =>
  request<SitePhoto[]>(`/api/projects/${projectId}/photos`);
export const getSitePhotos = (siteId: number) =>
  request<SitePhoto[]>(`/api/sites/${siteId}/photos`);
export const getPhoto = (photoId: number) =>
  request<SitePhoto>(`/api/photos/${photoId}`);
export const deletePhoto = (photoId: number) =>
  request<{ message: string }>(`/api/photos/${photoId}`, { method: "DELETE" });

// Daily Reports
export const createDailyReport = (data: Partial<DailyReport>) =>
  request<DailyReport>("/api/daily-reports", { method: "POST", body: JSON.stringify(data) });
export const getDailyReports = (projectId: number) =>
  request<DailyReport[]>(`/api/projects/${projectId}/daily-reports`);
export const getDailyReport = (reportId: number) =>
  request<DailyReport>(`/api/daily-reports/${reportId}`);
export const updateDailyReport = (reportId: number, data: Partial<DailyReport>) =>
  request<DailyReport>(`/api/daily-reports/${reportId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteDailyReport = (reportId: number) =>
  request<{ message: string }>(`/api/daily-reports/${reportId}`, { method: "DELETE" });

// Safety Incidents
export const createIncident = (data: Partial<SafetyIncident>) =>
  request<SafetyIncident>("/api/incidents", { method: "POST", body: JSON.stringify(data) });
export const getIncidents = (projectId: number) =>
  request<SafetyIncident[]>(`/api/projects/${projectId}/incidents`);
export const getSiteIncidents = (siteId: number) =>
  request<SafetyIncident[]>(`/api/sites/${siteId}/incidents`);
export const getIncident = (incidentId: number) =>
  request<SafetyIncident>(`/api/incidents/${incidentId}`);
export const updateIncident = (incidentId: number, data: Partial<SafetyIncident>) =>
  request<SafetyIncident>(`/api/incidents/${incidentId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteIncident = (incidentId: number) =>
  request<{ message: string }>(`/api/incidents/${incidentId}`, { method: "DELETE" });

// Inspections
export const createInspection = (data: Partial<InspectionReport>) =>
  request<InspectionReport>("/api/inspections", { method: "POST", body: JSON.stringify(data) });
export const getInspections = (projectId: number) =>
  request<InspectionReport[]>(`/api/projects/${projectId}/inspections`);
export const getInspection = (inspectionId: number) =>
  request<InspectionReport>(`/api/inspections/${inspectionId}`);
export const updateInspection = (inspectionId: number, data: Partial<InspectionReport>) =>
  request<InspectionReport>(`/api/inspections/${inspectionId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteInspection = (inspectionId: number) =>
  request<{ message: string }>(`/api/inspections/${inspectionId}`, { method: "DELETE" });

// Observations
export const createObservation = (data: Partial<Observation>) =>
  request<Observation>("/api/observations", { method: "POST", body: JSON.stringify(data) });
export const getObservations = (projectId: number) =>
  request<Observation[]>(`/api/projects/${projectId}/observations`);
export const getSiteObservations = (siteId: number) =>
  request<Observation[]>(`/api/sites/${siteId}/observations`);
export const getObservation = (observationId: number) =>
  request<Observation>(`/api/observations/${observationId}`);
export const updateObservation = (observationId: number, data: Partial<Observation>) =>
  request<Observation>(`/api/observations/${observationId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteObservation = (observationId: number) =>
  request<{ message: string }>(`/api/observations/${observationId}`, { method: "DELETE" });

// Materials
export const createMaterial = (data: Partial<Material>) =>
  request<Material>("/api/materials", { method: "POST", body: JSON.stringify(data) });
export const getMaterials = (projectId: number) =>
  request<Material[]>(`/api/projects/${projectId}/materials`);
export const getSiteMaterials = (siteId: number) =>
  request<Material[]>(`/api/sites/${siteId}/materials`);
export const getMaterial = (materialId: number) =>
  request<Material>(`/api/materials/${materialId}`);
export const updateMaterial = (materialId: number, data: Partial<Material>) =>
  request<Material>(`/api/materials/${materialId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteMaterial = (materialId: number) =>
  request<{ message: string }>(`/api/materials/${materialId}`, { method: "DELETE" });

// --- Health API ---
export const getHealth = () => request<{ status: string }>("/api/health");
export const getDbHealth = () => request<{ status: string }>("/api/db-health");

// ==========================================
// PHASE 4: AI COMPUTER VISION API
// ==========================================

export const AI_PPE_VIOLATION_TYPES = [
  "PERSON_WITHOUT_HELMET",
  "PERSON_WITHOUT_GLOVES",
  "PERSON_WITHOUT_BOOTS",
  "PERSON_WITHOUT_GOGGLES",
] as const;

export const AI_PPE_COMPLIANCE_TYPES = [
  "HELMET_DETECTED",
  "GLOVES_DETECTED",
  "BOOTS_DETECTED",
  "GOGGLES_DETECTED",
  "VEST_DETECTED",
] as const;

export type PPEViolationType = typeof AI_PPE_VIOLATION_TYPES[number];
export type PPEComplianceType = typeof AI_PPE_COMPLIANCE_TYPES[number];

export function isPPEViolation(finding: { finding_type: string }): boolean {
  return (AI_PPE_VIOLATION_TYPES as readonly string[]).includes(finding.finding_type);
}

export function isPPECompliance(finding: { finding_type: string }): boolean {
  return (AI_PPE_COMPLIANCE_TYPES as readonly string[]).includes(finding.finding_type);
}

export type FindingStatus = "OPEN" | "REVIEWED" | "RESOLVED" | "FALSE_POSITIVE";
export type FindingSeverity = "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface AIDetection {
  id: number;
  photo_id: number;
  analysis_run_id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  class_name: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  created_at: string;
}

export interface AISafetyFinding {
  id: number;
  photo_id: number;
  analysis_run_id: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  finding_type: string;
  severity: FindingSeverity;
  title: string;
  description?: string | null;
  confidence: number;
  status: FindingStatus;
  created_at: string;
}

export interface AIAnalysisRun {
  id: number;
  photo_id: number;
  model_name: string;
  model_version: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  processing_time_ms?: number | null;
  error_message?: string | null;
  annotated_file_path?: string | null;
  created_at: string;
  detections: AIDetection[];
  safety_findings: AISafetyFinding[];
}

export interface AnalysisResult {
  photo_id: number;
  analysis_run_id: number;
  status: string;
  model_name: string;
  model_version: string;
  processing_time_ms?: number | null;
  detections: AIDetection[];
  safety_findings: AISafetyFinding[];
  annotated_image_url?: string | null;
}

export interface AISummary {
  project_id: number;
  total_photos: number;
  photos_analyzed: number;
  total_findings: number;
  open_findings: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
  resolved_findings: number;
  false_positive_findings: number;
}

export interface BulkAnalysisResult {
  project_id: number;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  runs: AnalysisResult[];
}

// Trigger AI analysis on a single photo
export const analyzePhoto = (photoId: number, force: boolean = false, confidence?: number) => {
  const params = new URLSearchParams();
  if (force) params.append("force", "true");
  if (confidence !== undefined) params.append("confidence", String(confidence));
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<AnalysisResult>(`/api/photos/${photoId}/analyze${query}`, { method: "POST" });
};

// Get existing analysis for a photo
export const getPhotoAnalysis = (photoId: number) =>
  request<AIAnalysisRun>(`/api/photos/${photoId}/analysis`);

// Get detections for a photo
export const getPhotoDetections = (photoId: number) =>
  request<AIDetection[]>(`/api/photos/${photoId}/detections`);

// Get project AI safety findings with optional filters
export const getProjectAIFindings = (
  projectId: number,
  filters?: { site_id?: number; area_id?: number; severity?: string; finding_type?: string; status?: string }
) => {
  const params = new URLSearchParams();
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  if (filters?.severity) params.append("severity", filters.severity);
  if (filters?.finding_type) params.append("finding_type", filters.finding_type);
  if (filters?.status) params.append("status", filters.status);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<AISafetyFinding[]>(`/api/projects/${projectId}/ai-findings${query}`);
};

// Get project AI safety overview KPI summary
export const getProjectAISummary = (projectId: number) =>
  request<AISummary>(`/api/projects/${projectId}/ai-summary`);

// Human-in-the-loop review action on AI finding
export const updateAIFindingStatus = (findingId: number, status: FindingStatus) =>
  request<AISafetyFinding>(`/api/ai-findings/${findingId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

// Bulk analyze unanalyzed photos for a project
export const bulkAnalyzePendingPhotos = (projectId: number, limit: number = 20) =>
  request<BulkAnalysisResult>(`/api/projects/${projectId}/ai/analyze-pending?limit=${limit}`, {
    method: "POST",
  });


// ==========================================
// PHASE 5: CONSTRUCTION INTELLIGENCE ENGINE
// ==========================================

export interface RiskComponents {
  ai_findings: number;
  incidents: number;
  observations: number;
  inspections: number;
  recurring: number;
  trend: number;
}

export interface RiskExplanation {
  project_id: number;
  site_id?: number | null;
  area_id?: number | null;
  time_window_days: number;
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  data_confidence: "LOW" | "MEDIUM" | "HIGH";
  components: RiskComponents;
  reasons: string[];
  disclaimer: string;
}

export interface AreaRiskRankingItem {
  area_id: number;
  area_name: string;
  site_id: number;
  site_name: string;
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  open_issues: number;
  ai_findings_count: number;
  incidents_count: number;
  observations_count: number;
  trend: "INCREASING" | "DECREASING" | "STABLE";
  reasons: string[];
}

export interface RecurringIssue {
  id?: number;
  project_id: number;
  site_id: number;
  area_id?: number | null;
  area_name?: string | null;
  site_name?: string | null;
  issue_type: string;
  issue_category: string;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  time_window_days: number;
  severity: string;
  status: string;
  created_at?: string;
}

export interface DailyTrendItem {
  date: string;
  ai_findings: number;
  incidents: number;
  observations: number;
  total_safety: number;
}

export interface ProjectTrends {
  project_id: number;
  time_window_days: number;
  safety_trend: "INCREASING" | "DECREASING" | "STABLE";
  safety_change_pct: number;
  current_safety_count: number;
  previous_safety_count: number;
  ppe_trend: string;
  incident_trend: string;
  observation_trend: string;
  progress_trend: string;
  daily_series: DailyTrendItem[];
}

export interface PPEBreakdown {
  no_helmet: number;
  no_gloves: number;
  no_boots: number;
  no_goggles: number;
  other_violations: number;
  compliant_detections: number;
  total_ai_findings: number;
}

export interface SafetySummary {
  project_id: number;
  time_window_days: number;
  ai_findings_total: number;
  ai_findings_open: number;
  ai_violations_total?: number;
  ai_violations_open?: number;
  human_incidents_total: number;
  human_incidents_open: number;
  observations_total: number;
  observations_open: number;
  inspections_total: number;
  inspections_failed: number;
  inspections_passed: number;
  inspections_requires_action: number;
  inspection_failure_rate_pct: number;
  avg_resolution_time_hours?: number | null;
  oldest_unresolved_days?: number | null;
  ppe_breakdown: PPEBreakdown;
  human_vs_ai_ratio: string;
}

export interface OperationalRisk {
  project_id: number;
  low_stock_materials: Material[];
  delayed_materials: Material[];
  open_blockers: string[];
  progress_concerns: string[];
  operational_risk_level: "LOW" | "MEDIUM" | "HIGH";
}

export interface ProgressIntelligence {
  project_id: number;
  time_window_days: number;
  latest_progress_pct?: number | null;
  average_progress_pct?: number | null;
  previous_period_progress_pct?: number | null;
  progress_change_pct?: number | null;
  progress_trend: "IMPROVING" | "DECLINING" | "STABLE";
  latest_workers?: number | null;
  average_workers?: number | null;
  total_reports: number;
  blocked_days_count: number;
}

export interface ProjectIntelligence {
  project_id: number;
  time_window_days: number;
  project_risk: RiskExplanation;
  highest_risk_site?: string | null;
  highest_risk_area?: string | null;
  area_risks: AreaRiskRankingItem[];
  recurring_issues: RecurringIssue[];
  trends: ProjectTrends;
  safety_summary: SafetySummary;
  progress: ProgressIntelligence;
  operational_risk: OperationalRisk;
}

// Construction Intelligence API Client methods
export const getProjectIntelligence = (projectId: number, days: number = 7) =>
  request<ProjectIntelligence>(`/api/projects/${projectId}/intelligence?days=${days}`);

export const getProjectRisk = (
  projectId: number,
  days: number = 7,
  filters?: { site_id?: number; area_id?: number }
) => {
  const params = new URLSearchParams({ days: String(days) });
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  return request<RiskExplanation>(`/api/projects/${projectId}/risk?${params.toString()}`);
};

export const getProjectRiskExplanation = (
  projectId: number,
  days: number = 7,
  filters?: { site_id?: number; area_id?: number }
) => {
  const params = new URLSearchParams({ days: String(days) });
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  return request<RiskExplanation>(`/api/projects/${projectId}/risk/explanation?${params.toString()}`);
};

export const getAreaRiskRanking = (projectId: number, days: number = 7) =>
  request<AreaRiskRankingItem[]>(`/api/projects/${projectId}/risk/areas?days=${days}`);

export const getRecurringIssues = (
  projectId: number,
  days: number = 7,
  filters?: { site_id?: number; area_id?: number; threshold?: number }
) => {
  const params = new URLSearchParams({ days: String(days) });
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  if (filters?.threshold) params.append("threshold", String(filters.threshold));
  return request<RecurringIssue[]>(`/api/projects/${projectId}/recurring-issues?${params.toString()}`);
};

export const getProjectTrends = (
  projectId: number,
  days: number = 7,
  filters?: { site_id?: number; area_id?: number }
) => {
  const params = new URLSearchParams({ days: String(days) });
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  return request<ProjectTrends>(`/api/projects/${projectId}/trends?${params.toString()}`);
};

export const getSafetySummary = (
  projectId: number,
  days: number = 7,
  filters?: { site_id?: number; area_id?: number }
) => {
  const params = new URLSearchParams({ days: String(days) });
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  return request<SafetySummary>(`/api/projects/${projectId}/safety-summary?${params.toString()}`);
};

export const getOperationalRisk = (
  projectId: number,
  days: number = 7,
  filters?: { site_id?: number; area_id?: number }
) => {
  const params = new URLSearchParams({ days: String(days) });
  if (filters?.site_id) params.append("site_id", String(filters.site_id));
  if (filters?.area_id) params.append("area_id", String(filters.area_id));
  return request<OperationalRisk>(`/api/projects/${projectId}/operational-risk?${params.toString()}`);
};


// ==========================================
// PHASE 6: MANAGER DECISION CENTER
// ==========================================

export interface AttentionItem {
  id: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  category: "SAFETY_INCIDENT" | "AI_PPE" | "INSPECTION" | "OBSERVATION" | "MATERIAL" | "PROGRESS" | "RISK";
  action_url: string;
  action_label: string;
  created_at?: string | null;
}

export interface ExecutiveHealth {
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_trend: "INCREASING" | "DECREASING" | "STABLE";
  risk_change_pct: number;
  progress_pct?: number | null;
  progress_trend: "IMPROVING" | "DECLINING" | "STABLE";
  open_safety_issues: number;
  open_observations: number;
  operational_blockers: number;
  data_confidence: "LOW" | "MEDIUM" | "HIGH";
}

export interface DashboardProjectMeta {
  id: number;
  name: string;
  description?: string | null;
  location?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  site_count: number;
  area_count: number;
  member_count: number;
  last_updated: string;
}

export interface ManagerDashboardData {
  project: DashboardProjectMeta;
  executive_health: ExecutiveHealth;
  attention_items: AttentionItem[];
  risk: RiskExplanation;
  area_risk: AreaRiskRankingItem[];
  recurring_problems: RecurringIssue[];
  safety: SafetySummary;
  progress: ProgressIntelligence;
  materials: OperationalRisk;
  trends: ProjectTrends;
  recent_activity: ActivityItem[];
}

export const getProjectDashboard = (
  projectId: number,
  options?: { days?: number; site_id?: number; area_id?: number }
) => {
  const params = new URLSearchParams();
  if (options?.days !== undefined) params.append("days", String(options.days));
  if (options?.site_id !== undefined) params.append("site_id", String(options.site_id));
  if (options?.area_id !== undefined) params.append("area_id", String(options.area_id));
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<ManagerDashboardData>(`/api/projects/${projectId}/dashboard${query}`);
};

// --- Phase 7: GenAI Project Assistant API ---
export interface AssistantSource {
  type: string;
  id: string;
  title: string;
  detail?: string;
}

export interface AssistantRiskInfo {
  score: number;
  level: string;
  factors: string[];
  summary?: string | null;
}

export interface AssistantAttentionItem {
  id?: string | null;
  title: string;
  description?: string | null;
  severity: string;
  category?: string | null;
  status?: string | null;
  site_name?: string | null;
  area_name?: string | null;
  action_taken?: string | null;
}

export interface AssistantLocationItem {
  site_name?: string | null;
  area_name?: string | null;
  risk_score?: number | null;
  risk_level?: string | null;
  issue_summary?: string | null;
}

export interface AssistantActionItem {
  title: string;
  description?: string | null;
  priority: string;
  category?: string | null;
  role?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  link?: string | null;
}

export interface AssistantMaterialItem {
  name: string;
  status: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string | null;
  supplier?: string | null;
  notes?: string | null;
}

export interface AssistantProgressInfo {
  progress_pct?: number | null;
  workers_count?: number | null;
  work_completed?: string | null;
  weather?: string | null;
  blockers?: string | null;
}

export interface AssistantPPEInfo {
  compliance_count: number;
  violations_count: number;
  compliance_pct: number;
  violations_list: string[];
  compliance_items: string[];
}

export interface AssistantPipelineStep {
  name: string;
  description: string;
  icon: string;
}

export interface AssistantExplainability {
  retrieval_mode: string;
  sql_facts_count: number;
  semantic_chunks_count: number;
  risk_engine_score: number;
  risk_engine_level: string;
  llm_model: string;
  pipeline_steps: AssistantPipelineStep[];
}

export interface AssistantStructuredResponse {
  query_type: string;
  executive_summary: string;
  risk?: AssistantRiskInfo | null;
  attention_items: AssistantAttentionItem[];
  locations: AssistantLocationItem[];
  recommended_actions: AssistantActionItem[];
  materials: AssistantMaterialItem[];
  progress?: AssistantProgressInfo | null;
  ppe?: AssistantPPEInfo | null;
  sources: AssistantSource[];
  explainability: AssistantExplainability;
  suggested_followups: string[];
}

export interface AssistantChatResponse {
  project_id: number;
  answer: string;
  sources: AssistantSource[];
  data_used: string[];
  structured?: AssistantStructuredResponse | null;
}

export const chatWithAssistant = (projectId: number, message: string) =>
  request<AssistantChatResponse>(`/api/projects/${projectId}/assistant/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });

// --- Phase 8: Hybrid RAG API ---
export interface RAGIndexResponse {
  status: string;
  project_id: number;
  project_name: string;
  total_indexed: number;
  breakdown: Record<string, number>;
}

export interface RAGStatusResponse {
  project_id: number;
  total_documents: number;
  by_source_type: Record<string, number>;
  embedding_provider: {
    provider: string;
    dimension: number;
    is_external: boolean;
    fallback_available: boolean;
  };
  last_indexed_at?: string | null;
}

export const indexProjectRAG = (projectId: number) =>
  request<RAGIndexResponse>(`/api/projects/${projectId}/rag/index`, {
    method: "POST",
  });

export const getProjectRAGStatus = (projectId: number) =>
  request<RAGStatusResponse>(`/api/projects/${projectId}/rag/status`);

