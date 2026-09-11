export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

export type ProjectRole =
  | "PROJECT_MANAGER"
  | "SITE_SUPERVISOR"
  | "SAFETY_OFFICER"
  | "CONTRACTOR"
  | "ADMIN";

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

// Generic API caller with comprehensive error handling
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
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

    // Handle 204 or empty responses
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

// Project API
export const getProjects = () => request<Project[]>("/api/projects");
export const getProject = (id: number) => request<ProjectDetail>(`/api/projects/${id}`);
export const createProject = (data: Partial<Project>) =>
  request<Project>("/api/projects", { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: number, data: Partial<Project>) =>
  request<Project>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteProject = (id: number) =>
  request<{ message: string }>(`/api/projects/${id}`, { method: "DELETE" });

// Site API
export const getSitesForProject = (projectId: number) =>
  request<Site[]>(`/api/projects/${projectId}/sites`);
export const createSite = (projectId: number, data: { name: string; address?: string; description?: string }) =>
  request<Site>(`/api/projects/${projectId}/sites`, { method: "POST", body: JSON.stringify(data) });
export const getSite = (siteId: number) => request<Site>(`/api/sites/${siteId}`);
export const updateSite = (siteId: number, data: { name?: string; address?: string; description?: string }) =>
  request<Site>(`/api/sites/${siteId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSite = (siteId: number) =>
  request<{ message: string }>(`/api/sites/${siteId}`, { method: "DELETE" });

// Area API
export const getAreasForSite = (siteId: number) =>
  request<Area[]>(`/api/sites/${siteId}/areas`);
export const createArea = (siteId: number, data: { name: string; area_type?: string; description?: string }) =>
  request<Area>(`/api/sites/${siteId}/areas`, { method: "POST", body: JSON.stringify(data) });
export const getArea = (areaId: number) => request<Area>(`/api/areas/${areaId}`);
export const updateArea = (areaId: number, data: { name?: string; area_type?: string; description?: string }) =>
  request<Area>(`/api/areas/${areaId}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteArea = (areaId: number) =>
  request<{ message: string }>(`/api/areas/${areaId}`, { method: "DELETE" });

// Member API
export const getProjectMembers = (projectId: number) =>
  request<ProjectMember[]>(`/api/projects/${projectId}/members`);
export const addProjectMember = (projectId: number, data: { user_id: number; role: ProjectRole }) =>
  request<ProjectMember>(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify(data) });
export const updateProjectMemberRole = (projectId: number, userId: number, data: { role: ProjectRole }) =>
  request<ProjectMember>(`/api/projects/${projectId}/members/${userId}`, { method: "PUT", body: JSON.stringify(data) });
export const removeProjectMember = (projectId: number, userId: number) =>
  request<{ message: string }>(`/api/projects/${projectId}/members/${userId}`, { method: "DELETE" });

// Users API
export const getUsers = () => request<User[]>("/api/users");
export const createUser = (data: { name: string; email: string; role: string; password?: string }) =>
  request<User>("/api/users", { method: "POST", body: JSON.stringify(data) });

// Health API
export const getHealth = () => request<{ status: string }>("/api/health");
export const getDbHealth = () => request<{ status: string }>("/api/db-health");
