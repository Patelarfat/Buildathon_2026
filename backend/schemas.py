from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator


# --- User Schemas ---
class UserBase(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)


class UserCreate(UserBase):
    password: str = Field("password123", min_length=1)


class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True


# --- Area Schemas ---
class AreaBase(BaseModel):
    name: str = Field(..., min_length=1)
    area_type: Optional[str] = None
    description: Optional[str] = None


class AreaCreate(AreaBase):
    pass


class AreaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    area_type: Optional[str] = None
    description: Optional[str] = None


class AreaResponse(AreaBase):
    id: int
    site_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Site Schemas ---
class SiteBase(BaseModel):
    name: str = Field(..., min_length=1)
    address: Optional[str] = None
    description: Optional[str] = None


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    address: Optional[str] = None
    description: Optional[str] = None


class SiteResponse(SiteBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SiteDetailResponse(SiteResponse):
    areas: List[AreaResponse] = []


# --- Project Member Schemas ---
VALID_ROLES = {
    "PROJECT_MANAGER",
    "SITE_SUPERVISOR",
    "SAFETY_OFFICER",
    "CONTRACTOR",
    "ADMIN"
}


class ProjectMemberBase(BaseModel):
    role: str

    @field_validator("role")
    def validate_role(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(sorted(VALID_ROLES))}")
        return v_upper


class ProjectMemberCreate(ProjectMemberBase):
    user_id: int


class ProjectMemberUpdate(ProjectMemberBase):
    pass


class ProjectMemberResponse(ProjectMemberBase):
    id: int
    project_id: int
    user_id: int
    joined_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# --- Project Schemas ---
VALID_STATUSES = {
    "PLANNING",
    "ACTIVE",
    "ON_HOLD",
    "COMPLETED"
}


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    location: Optional[str] = None
    status: str = "PLANNING"
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v_upper


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v_upper


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectDetailResponse(ProjectResponse):
    sites: List[SiteDetailResponse] = []
    members: List[ProjectMemberResponse] = []


# ==========================================
# PHASE 3: FIELD DATA COLLECTION SCHEMAS
# ==========================================

# --- 1. Site Photos ---
class SitePhotoResponse(BaseModel):
    id: int
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    uploaded_by: int
    file_name: str
    file_path: str
    caption: Optional[str] = None
    taken_at: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: datetime
    uploader: Optional[UserResponse] = None
    site: Optional[SiteResponse] = None
    area: Optional[AreaResponse] = None

    class Config:
        from_attributes = True


# --- 2. Daily Reports ---
class DailyReportBase(BaseModel):
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    reported_by: int
    report_date: str = Field(..., min_length=1)
    work_completed: Optional[str] = None
    work_planned: Optional[str] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    workers_count: Optional[int] = Field(None, ge=0)
    weather: Optional[str] = None
    equipment_used: Optional[str] = None
    materials_used: Optional[str] = None
    issues: Optional[str] = None
    blockers: Optional[str] = None
    notes: Optional[str] = None


class DailyReportCreate(DailyReportBase):
    pass


class DailyReportUpdate(BaseModel):
    area_id: Optional[int] = None
    report_date: Optional[str] = None
    work_completed: Optional[str] = None
    work_planned: Optional[str] = None
    progress_percentage: Optional[int] = Field(None, ge=0, le=100)
    workers_count: Optional[int] = Field(None, ge=0)
    weather: Optional[str] = None
    equipment_used: Optional[str] = None
    materials_used: Optional[str] = None
    issues: Optional[str] = None
    blockers: Optional[str] = None
    notes: Optional[str] = None


class DailyReportResponse(DailyReportBase):
    id: int
    created_at: datetime
    updated_at: datetime
    reporter: Optional[UserResponse] = None
    site: Optional[SiteResponse] = None
    area: Optional[AreaResponse] = None

    class Config:
        from_attributes = True


# --- 3. Safety Incidents ---
VALID_INCIDENT_TYPES = {
    "PPE_VIOLATION",
    "FALL",
    "INJURY",
    "EQUIPMENT_ACCIDENT",
    "UNSAFE_BEHAVIOR",
    "UNSAFE_CONDITION",
    "OTHER"
}

VALID_SEVERITIES = {
    "LOW",
    "MEDIUM",
    "HIGH",
    "CRITICAL"
}

VALID_INCIDENT_STATUSES = {
    "OPEN",
    "UNDER_REVIEW",
    "RESOLVED"
}


class SafetyIncidentBase(BaseModel):
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    reported_by: int
    incident_date: str = Field(..., min_length=1)
    incident_type: str
    severity: str
    description: str = Field(..., min_length=1)
    action_taken: Optional[str] = None
    status: str = "OPEN"
    resolved_at: Optional[str] = None

    @field_validator("incident_type")
    def validate_type(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_INCIDENT_TYPES:
            raise ValueError(f"Incident type must be one of: {', '.join(sorted(VALID_INCIDENT_TYPES))}")
        return v_upper

    @field_validator("severity")
    def validate_severity(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_SEVERITIES:
            raise ValueError(f"Severity must be one of: {', '.join(sorted(VALID_SEVERITIES))}")
        return v_upper

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_INCIDENT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_INCIDENT_STATUSES))}")
        return v_upper


class SafetyIncidentCreate(SafetyIncidentBase):
    pass


class SafetyIncidentUpdate(BaseModel):
    area_id: Optional[int] = None
    incident_date: Optional[str] = None
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None
    action_taken: Optional[str] = None
    status: Optional[str] = None
    resolved_at: Optional[str] = None

    @field_validator("incident_type")
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_INCIDENT_TYPES:
            raise ValueError(f"Incident type must be one of: {', '.join(sorted(VALID_INCIDENT_TYPES))}")
        return v_upper

    @field_validator("severity")
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_SEVERITIES:
            raise ValueError(f"Severity must be one of: {', '.join(sorted(VALID_SEVERITIES))}")
        return v_upper

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_INCIDENT_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_INCIDENT_STATUSES))}")
        return v_upper


class SafetyIncidentResponse(SafetyIncidentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    reporter: Optional[UserResponse] = None
    site: Optional[SiteResponse] = None
    area: Optional[AreaResponse] = None

    class Config:
        from_attributes = True


# --- 4. Inspection Reports ---
VALID_INSPECTION_TYPES = {
    "SAFETY",
    "QUALITY",
    "EQUIPMENT",
    "ENVIRONMENTAL",
    "GENERAL"
}

VALID_INSPECTION_STATUSES = {
    "OPEN",
    "PASSED",
    "FAILED",
    "REQUIRES_ACTION"
}


class InspectionReportBase(BaseModel):
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    inspector_id: int
    inspection_date: str = Field(..., min_length=1)
    inspection_type: str
    status: str = "OPEN"
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("inspection_type")
    def validate_type(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_INSPECTION_TYPES:
            raise ValueError(f"Inspection type must be one of: {', '.join(sorted(VALID_INSPECTION_TYPES))}")
        return v_upper

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_INSPECTION_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_INSPECTION_STATUSES))}")
        return v_upper


class InspectionReportCreate(InspectionReportBase):
    pass


class InspectionReportUpdate(BaseModel):
    area_id: Optional[int] = None
    inspection_date: Optional[str] = None
    inspection_type: Optional[str] = None
    status: Optional[str] = None
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("inspection_type")
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_INSPECTION_TYPES:
            raise ValueError(f"Inspection type must be one of: {', '.join(sorted(VALID_INSPECTION_TYPES))}")
        return v_upper

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_INSPECTION_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_INSPECTION_STATUSES))}")
        return v_upper


class InspectionReportResponse(InspectionReportBase):
    id: int
    created_at: datetime
    updated_at: datetime
    inspector: Optional[UserResponse] = None
    site: Optional[SiteResponse] = None
    area: Optional[AreaResponse] = None

    class Config:
        from_attributes = True


# --- 5. Observations ---
VALID_OBSERVATION_TYPES = {
    "PROGRESS",
    "SAFETY",
    "QUALITY",
    "MATERIAL",
    "EQUIPMENT",
    "GENERAL"
}

VALID_PRIORITIES = {
    "LOW",
    "MEDIUM",
    "HIGH"
}

VALID_OBSERVATION_STATUSES = {
    "OPEN",
    "IN_PROGRESS",
    "RESOLVED"
}


class ObservationBase(BaseModel):
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    created_by: int
    observation_type: str
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    priority: str = "MEDIUM"
    status: str = "OPEN"
    assigned_to: Optional[int] = None
    observed_at: Optional[str] = None
    resolved_at: Optional[str] = None

    @field_validator("observation_type")
    def validate_type(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_OBSERVATION_TYPES:
            raise ValueError(f"Observation type must be one of: {', '.join(sorted(VALID_OBSERVATION_TYPES))}")
        return v_upper

    @field_validator("priority")
    def validate_priority(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v_upper

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_OBSERVATION_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_OBSERVATION_STATUSES))}")
        return v_upper


class ObservationCreate(ObservationBase):
    pass


class ObservationUpdate(BaseModel):
    area_id: Optional[int] = None
    observation_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    observed_at: Optional[str] = None
    resolved_at: Optional[str] = None

    @field_validator("observation_type")
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_OBSERVATION_TYPES:
            raise ValueError(f"Observation type must be one of: {', '.join(sorted(VALID_OBSERVATION_TYPES))}")
        return v_upper

    @field_validator("priority")
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}")
        return v_upper

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_OBSERVATION_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_OBSERVATION_STATUSES))}")
        return v_upper


class ObservationResponse(ObservationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    creator: Optional[UserResponse] = None
    assignee: Optional[UserResponse] = None
    site: Optional[SiteResponse] = None
    area: Optional[AreaResponse] = None

    class Config:
        from_attributes = True


# --- 6. Materials ---
VALID_MATERIAL_STATUSES = {
    "ORDERED",
    "DELIVERED",
    "IN_USE",
    "LOW_STOCK"
}


class MaterialBase(BaseModel):
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    recorded_by: int
    material_name: str = Field(..., min_length=1)
    category: Optional[str] = None
    quantity: float = Field(0.0, ge=0)
    unit: str = Field(..., min_length=1)
    status: str = "ORDERED"
    supplier: Optional[str] = None
    delivery_date: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_MATERIAL_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_MATERIAL_STATUSES))}")
        return v_upper


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    area_id: Optional[int] = None
    material_name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    status: Optional[str] = None
    supplier: Optional[str] = None
    delivery_date: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper()
        if v_upper not in VALID_MATERIAL_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_MATERIAL_STATUSES))}")
        return v_upper


class MaterialResponse(MaterialBase):
    id: int
    created_at: datetime
    updated_at: datetime
    recorder: Optional[UserResponse] = None
    site: Optional[SiteResponse] = None
    area: Optional[AreaResponse] = None

    class Config:
        from_attributes = True


# --- Activity Feed Schema ---
class ActivityItemResponse(BaseModel):
    id: int
    type: str  # "PHOTO", "REPORT", "INCIDENT", "INSPECTION", "OBSERVATION", "MATERIAL"
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    severity_or_priority: Optional[str] = None
    site_name: Optional[str] = None
    area_name: Optional[str] = None
    user_name: Optional[str] = None
    date: str
    created_at: datetime
