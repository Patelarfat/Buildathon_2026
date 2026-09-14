from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator


# --- User Schemas ---
VALID_ROLES = {
    "PROJECT_MANAGER",
    "SITE_SUPERVISOR",
    "SAFETY_OFFICER",
    "CONTRACTOR",
    "ADMIN"
}

ROLE_NORMALIZATION_MAP = {
    "PROJECT_MANAGER": "PROJECT_MANAGER",
    "PROJECT MANAGER": "PROJECT_MANAGER",
    "SITE_SUPERVISOR": "SITE_SUPERVISOR",
    "SITE SUPERVISOR": "SITE_SUPERVISOR",
    "SUPERVISOR": "SITE_SUPERVISOR",
    "SITE_ENGINEER": "SITE_SUPERVISOR",
    "SITE ENGINEER": "SITE_SUPERVISOR",
    "ENGINEER": "SITE_SUPERVISOR",
    "ENGINEER2": "SITE_SUPERVISOR",
    "SAFETY_OFFICER": "SAFETY_OFFICER",
    "SAFETY OFFICER": "SAFETY_OFFICER",
    "CONTRACTOR": "CONTRACTOR",
    "ADMIN": "ADMIN",
    "CONSTRUCTION ADMINISTRATOR": "ADMIN",
    "CONSTRUCTION_ADMINISTRATOR": "ADMIN",
    "ADMINISTRATOR": "ADMIN",
}


def normalize_role(v: str) -> str:
    if not v:
        return "PROJECT_MANAGER"
    cleaned = v.strip().upper().replace("-", "_")
    if cleaned in ROLE_NORMALIZATION_MAP:
        return ROLE_NORMALIZATION_MAP[cleaned]
    underscore_version = cleaned.replace(" ", "_")
    if underscore_version in VALID_ROLES:
        return underscore_version
    if underscore_version in ROLE_NORMALIZATION_MAP:
        return ROLE_NORMALIZATION_MAP[underscore_version]
    if cleaned in VALID_ROLES:
        return cleaned
    if "ENGINEER" in cleaned or "SUPERVISOR" in cleaned:
        return "SITE_SUPERVISOR"
    if "SAFETY" in cleaned:
        return "SAFETY_OFFICER"
    if "ADMIN" in cleaned:
        return "ADMIN"
    if "CONTRACT" in cleaned:
        return "CONTRACTOR"
    if "MANAGE" in cleaned:
        return "PROJECT_MANAGER"
    return "CONTRACTOR"


class UserBase(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=1)
    role: str = Field(..., min_length=1)

    @field_validator("role")
    def validate_role(cls, v: str) -> str:
        return normalize_role(v)


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
class ProjectMemberBase(BaseModel):
    role: str

    @field_validator("role")
    def validate_role(cls, v: str) -> str:
        return normalize_role(v)


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

INCIDENT_TYPE_MAP = {
    "PPE_VIOLATION": "PPE_VIOLATION",
    "PPE VIOLATION": "PPE_VIOLATION",
    "FALL": "FALL",
    "FALL_HAZARD": "FALL",
    "FALL HAZARD": "FALL",
    "SLIP_TRIP": "FALL",
    "SLIP TRIP": "FALL",
    "SLIP": "FALL",
    "TRIP": "FALL",
    "INJURY": "INJURY",
    "WORKER_INJURY": "INJURY",
    "EQUIPMENT_ACCIDENT": "EQUIPMENT_ACCIDENT",
    "EQUIPMENT ACCIDENT": "EQUIPMENT_ACCIDENT",
    "EQUIPMENT_FAILURE": "EQUIPMENT_ACCIDENT",
    "EQUIPMENT FAILURE": "EQUIPMENT_ACCIDENT",
    "UNSAFE_BEHAVIOR": "UNSAFE_BEHAVIOR",
    "UNSAFE BEHAVIOR": "UNSAFE_BEHAVIOR",
    "UNSAFE_CONDITION": "UNSAFE_CONDITION",
    "UNSAFE CONDITION": "UNSAFE_CONDITION",
    "COLLAPSE": "UNSAFE_CONDITION",
    "NEAR_MISS": "UNSAFE_CONDITION",
    "NEAR MISS": "UNSAFE_CONDITION",
    "HAZARD": "UNSAFE_CONDITION",
    "OTHER": "OTHER"
}

def normalize_incident_type(v: Optional[str]) -> str:
    if not v:
        return "OTHER"
    cleaned = v.strip().upper().replace("-", "_")
    if cleaned in INCIDENT_TYPE_MAP:
        return INCIDENT_TYPE_MAP[cleaned]
    if cleaned in VALID_INCIDENT_TYPES:
        return cleaned
    if "FALL" in cleaned or "SLIP" in cleaned or "TRIP" in cleaned:
        return "FALL"
    if "EQUIP" in cleaned or "MACHIN" in cleaned:
        return "EQUIPMENT_ACCIDENT"
    if "PPE" in cleaned or "HELMET" in cleaned or "VEST" in cleaned:
        return "PPE_VIOLATION"
    if "INJUR" in cleaned:
        return "INJURY"
    if "BEHAV" in cleaned:
        return "UNSAFE_BEHAVIOR"
    if "COND" in cleaned or "HAZARD" in cleaned or "COLLAPSE" in cleaned or "MISS" in cleaned:
        return "UNSAFE_CONDITION"
    return "OTHER"

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
        return normalize_incident_type(v)

    @field_validator("severity")
    def validate_severity(cls, v: str) -> str:
        v_upper = v.upper().strip() if v else "MEDIUM"
        if v_upper in VALID_SEVERITIES:
            return v_upper
        return "MEDIUM"

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper().strip().replace(" ", "_") if v else "OPEN"
        if v_upper in VALID_INCIDENT_STATUSES:
            return v_upper
        return "OPEN"


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
        return normalize_incident_type(v)

    @field_validator("severity")
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper().strip()
        if v_upper in VALID_SEVERITIES:
            return v_upper
        return "MEDIUM"

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper().strip().replace(" ", "_")
        if v_upper in VALID_INCIDENT_STATUSES:
            return v_upper
        return "OPEN"


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

def normalize_inspection_type(v: Optional[str]) -> str:
    if not v:
        return "GENERAL"
    cleaned = v.strip().upper().replace("-", "_")
    if cleaned in VALID_INSPECTION_TYPES:
        return cleaned
    if "STRUCT" in cleaned or "SAFETY" in cleaned or "PPE" in cleaned:
        return "SAFETY"
    if "QUAL" in cleaned:
        return "QUALITY"
    if "EQUIP" in cleaned or "MACHIN" in cleaned:
        return "EQUIPMENT"
    if "ENV" in cleaned or "HOUSEKEEP" in cleaned:
        return "ENVIRONMENTAL"
    return "GENERAL"

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
        return normalize_inspection_type(v)

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper().strip().replace(" ", "_") if v else "OPEN"
        if v_upper in VALID_INSPECTION_STATUSES:
            return v_upper
        return "OPEN"


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
        return normalize_inspection_type(v)

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper().strip().replace(" ", "_")
        if v_upper in VALID_INSPECTION_STATUSES:
            return v_upper
        return "OPEN"


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

def normalize_observation_type(v: Optional[str]) -> str:
    if not v:
        return "GENERAL"
    cleaned = v.strip().upper().replace("-", "_")
    if cleaned in VALID_OBSERVATION_TYPES:
        return cleaned
    if "SAFE" in cleaned:
        return "SAFETY"
    if "QUAL" in cleaned:
        return "QUALITY"
    if "MAT" in cleaned or "STOR" in cleaned:
        return "MATERIAL"
    if "EQUIP" in cleaned:
        return "EQUIPMENT"
    if "PROG" in cleaned:
        return "PROGRESS"
    return "GENERAL"

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
        return normalize_observation_type(v)

    @field_validator("priority")
    def validate_priority(cls, v: str) -> str:
        v_upper = v.upper().strip() if v else "MEDIUM"
        if v_upper in VALID_PRIORITIES:
            return v_upper
        return "MEDIUM"

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper().strip().replace(" ", "_") if v else "OPEN"
        if v_upper in VALID_OBSERVATION_STATUSES:
            return v_upper
        return "OPEN"


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
        return normalize_observation_type(v)

    @field_validator("priority")
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper().strip()
        if v_upper in VALID_PRIORITIES:
            return v_upper
        return "MEDIUM"

    @field_validator("status")
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v_upper = v.upper().strip().replace(" ", "_")
        if v_upper in VALID_OBSERVATION_STATUSES:
            return v_upper
        return "OPEN"


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
    "LOW_STOCK",
    "OUT_OF_STOCK",
    "AVAILABLE",
    "DELAYED",
    "SHORTAGE"
}

def normalize_material_status(v: Optional[str]) -> str:
    if not v:
        return "ORDERED"
    cleaned = v.strip().upper().replace("-", "_").replace(" ", "_")
    if cleaned in VALID_MATERIAL_STATUSES:
        return cleaned
    if "SHORT" in cleaned or "OUT" in cleaned:
        return "LOW_STOCK"
    if "DELAY" in cleaned:
        return "ORDERED"
    if "AVAIL" in cleaned or "DELIV" in cleaned:
        return "DELIVERED"
    if "USE" in cleaned:
        return "IN_USE"
    return "ORDERED"


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
        return normalize_material_status(v)


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
        return normalize_material_status(v)
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


# ==========================================
# PHASE 4: AI COMPUTER VISION SCHEMAS
# ==========================================

VALID_FINDING_STATUSES = {
    "OPEN",
    "REVIEWED",
    "RESOLVED",
    "FALSE_POSITIVE"
}

VALID_FINDING_SEVERITIES = {
    "HIGH",
    "MEDIUM",
    "LOW",
    "INFO"
}


class AIDetectionResponse(BaseModel):
    id: int
    photo_id: int
    analysis_run_id: int
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    class_name: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float
    created_at: datetime

    class Config:
        from_attributes = True


class AISafetyFindingBase(BaseModel):
    photo_id: int
    analysis_run_id: int
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    finding_type: str
    severity: str
    title: str
    description: Optional[str] = None
    confidence: float
    status: str = "OPEN"

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_FINDING_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_FINDING_STATUSES))}")
        return v_upper

    @field_validator("severity")
    def validate_severity(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_FINDING_SEVERITIES:
            raise ValueError(f"Severity must be one of: {', '.join(sorted(VALID_FINDING_SEVERITIES))}")
        return v_upper


class AISafetyFindingUpdate(BaseModel):
    status: str

    @field_validator("status")
    def validate_status(cls, v: str) -> str:
        v_upper = v.upper()
        if v_upper not in VALID_FINDING_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_FINDING_STATUSES))}")
        return v_upper


class AISafetyFindingResponse(AISafetyFindingBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PPEItemStatus(BaseModel):
    detected: bool
    confidence: Optional[float] = None


class PersonPPEStatus(BaseModel):
    person_id: int
    confidence: float
    helmet: PPEItemStatus
    vest: PPEItemStatus
    gloves: PPEItemStatus
    boots: PPEItemStatus
    violations: List[str] = []
    compliant: bool


class PPESummary(BaseModel):
    workers_detected: int
    fully_compliant: int
    workers_with_violations: int
    overall_compliance: float


class AIAnalysisRunResponse(BaseModel):
    id: int
    photo_id: int
    model_name: str
    model_version: str
    status: str
    processing_time_ms: Optional[float] = None
    error_message: Optional[str] = None
    annotated_file_path: Optional[str] = None
    created_at: datetime
    detections: List[AIDetectionResponse] = []
    safety_findings: List[AISafetyFindingResponse] = []
    people: List[PersonPPEStatus] = []
    summary: Optional[PPESummary] = None

    class Config:
        from_attributes = True


class AnalysisResultResponse(BaseModel):
    photo_id: int
    analysis_run_id: int
    status: str
    model_name: str
    model_version: str
    processing_time_ms: Optional[float] = None
    detections: List[AIDetectionResponse] = []
    safety_findings: List[AISafetyFindingResponse] = []
    annotated_image_url: Optional[str] = None
    people: List[PersonPPEStatus] = []
    summary: Optional[PPESummary] = None


class AISummaryResponse(BaseModel):
    project_id: int
    total_photos: int
    photos_analyzed: int
    total_findings: int
    open_findings: int
    high_severity: int
    medium_severity: int
    low_severity: int
    resolved_findings: int
    false_positive_findings: int


class BulkAnalysisResponse(BaseModel):
    project_id: int
    total: int
    processed: int
    successful: int
    failed: int
    runs: List[AnalysisResultResponse] = []


# ==========================================
# PHASE 5: CONSTRUCTION INTELLIGENCE SCHEMAS
# ==========================================

class RiskComponents(BaseModel):
    ai_findings: float
    incidents: float
    observations: float
    inspections: float
    recurring: float
    trend: float


class RiskExplanationResponse(BaseModel):
    project_id: int
    site_id: Optional[int] = None
    area_id: Optional[int] = None
    time_window_days: int
    score: int
    level: str  # LOW, MEDIUM, HIGH, CRITICAL
    data_confidence: str  # LOW, MEDIUM, HIGH
    components: RiskComponents
    reasons: List[str]
    disclaimer: str = "This risk score is an explainable project-management indicator based on current safety records, not a statistical probability of an accident."


class RiskAssessmentResponse(BaseModel):
    id: Optional[int] = None
    project_id: int
    site_id: Optional[int] = None
    area_id: Optional[int] = None
    assessment_date: str
    time_window_days: int
    risk_score: int
    risk_level: str
    data_confidence: str
    components: RiskComponents
    reasons: List[str]
    calculated_at: datetime

    class Config:
        from_attributes = True


class AreaRiskRankingItem(BaseModel):
    area_id: int
    area_name: str
    site_id: int
    site_name: str
    risk_score: int
    risk_level: str
    open_issues: int
    ai_findings_count: int
    incidents_count: int
    observations_count: int
    trend: str  # INCREASING, DECREASING, STABLE
    reasons: List[str] = []


class RecurringIssueResponse(BaseModel):
    id: Optional[int] = None
    project_id: int
    site_id: int
    area_id: Optional[int] = None
    area_name: Optional[str] = None
    site_name: Optional[str] = None
    issue_type: str
    issue_category: str
    occurrence_count: int
    first_seen: str
    last_seen: str
    time_window_days: int
    severity: str
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DailyTrendItem(BaseModel):
    date: str
    ai_findings: int = 0
    incidents: int = 0
    observations: int = 0
    total_safety: int = 0


class ProjectTrendsResponse(BaseModel):
    project_id: int
    time_window_days: int
    safety_trend: str  # INCREASING, DECREASING, STABLE
    safety_change_pct: float
    current_safety_count: int
    previous_safety_count: int
    ppe_trend: str
    incident_trend: str
    observation_trend: str
    progress_trend: str
    daily_series: List[DailyTrendItem] = []


class PPEBreakdown(BaseModel):
    no_helmet: int = 0
    no_gloves: int = 0
    no_boots: int = 0
    no_goggles: int = 0
    other_violations: int = 0
    compliant_detections: int = 0
    total_ai_findings: int = 0


class SafetySummaryResponse(BaseModel):
    project_id: int
    time_window_days: int
    ai_findings_total: int
    ai_findings_open: int
    ai_violations_total: int = 0
    ai_violations_open: int = 0
    human_incidents_total: int
    human_incidents_open: int
    observations_total: int
    observations_open: int
    inspections_total: int
    inspections_failed: int
    inspections_passed: int
    inspections_requires_action: int
    inspection_failure_rate_pct: float
    avg_resolution_time_hours: Optional[float] = None
    oldest_unresolved_days: Optional[int] = None
    ppe_breakdown: PPEBreakdown
    human_vs_ai_ratio: str


class OperationalRiskResponse(BaseModel):
    project_id: int
    low_stock_materials: List[MaterialResponse] = []
    delayed_materials: List[MaterialResponse] = []
    open_blockers: List[str] = []
    progress_concerns: List[str] = []
    operational_risk_level: str  # LOW, MEDIUM, HIGH


class ProgressIntelligenceResponse(BaseModel):
    project_id: int
    time_window_days: int
    latest_progress_pct: Optional[int] = None
    average_progress_pct: Optional[float] = None
    previous_period_progress_pct: Optional[float] = None
    progress_change_pct: Optional[float] = None
    progress_trend: str  # IMPROVING, DECLINING, STABLE
    latest_workers: Optional[int] = None
    average_workers: Optional[float] = None
    total_reports: int = 0
    blocked_days_count: int = 0


class ProjectIntelligenceResponse(BaseModel):
    project_id: int
    time_window_days: int
    project_risk: RiskExplanationResponse
    highest_risk_site: Optional[str] = None
    highest_risk_area: Optional[str] = None
    area_risks: List[AreaRiskRankingItem] = []
    recurring_issues: List[RecurringIssueResponse] = []
    trends: ProjectTrendsResponse
    safety_summary: SafetySummaryResponse
    progress: ProgressIntelligenceResponse
    operational_risk: OperationalRiskResponse


# ==========================================
# PHASE 6: MANAGER DECISION CENTER SCHEMAS
# ==========================================

class AttentionItem(BaseModel):
    id: str
    priority: str  # CRITICAL, HIGH, MEDIUM, LOW
    title: str
    description: str
    category: str  # SAFETY_INCIDENT, AI_PPE, INSPECTION, OBSERVATION, MATERIAL, PROGRESS, RISK
    action_url: str
    action_label: str
    created_at: Optional[str] = None


class ExecutiveHealth(BaseModel):
    risk_score: int
    risk_level: str
    risk_trend: str
    risk_change_pct: float
    progress_pct: Optional[int] = None
    progress_trend: str
    open_safety_issues: int
    open_observations: int
    operational_blockers: int
    data_confidence: str


class DashboardProjectMeta(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    status: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    site_count: int
    area_count: int
    member_count: int
    last_updated: str


class ManagerDashboardResponse(BaseModel):
    project: DashboardProjectMeta
    executive_health: ExecutiveHealth
    attention_items: List[AttentionItem] = []
    risk: RiskExplanationResponse
    area_risk: List[AreaRiskRankingItem] = []
    recurring_problems: List[RecurringIssueResponse] = []
    safety: SafetySummaryResponse
    progress: ProgressIntelligenceResponse
    materials: OperationalRiskResponse
    trends: ProjectTrendsResponse
    recent_activity: List[ActivityItemResponse] = []


# ==========================================
# PHASE 7: GENAI PROJECT ASSISTANT SCHEMAS
# ==========================================

class AssistantSource(BaseModel):
    type: str
    id: str
    title: str
    detail: Optional[str] = None


class AssistantChatRequest(BaseModel):
    message: str = Field(..., max_length=2000, description="Project management natural language query")


class AssistantRiskInfo(BaseModel):
    score: int
    level: str
    factors: List[str] = []
    summary: Optional[str] = None


class AssistantAttentionItem(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    severity: str = "MEDIUM"
    category: Optional[str] = None
    status: Optional[str] = "OPEN"
    site_name: Optional[str] = None
    area_name: Optional[str] = None
    action_taken: Optional[str] = None


class AssistantLocationItem(BaseModel):
    site_name: Optional[str] = None
    area_name: Optional[str] = None
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None
    issue_summary: Optional[str] = None


class AssistantActionItem(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "STANDARD"
    category: Optional[str] = None
    role: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    link: Optional[str] = None


class AssistantMaterialItem(BaseModel):
    name: str
    status: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


class AssistantProgressInfo(BaseModel):
    report_type: str = "DAILY"
    reporting_period: Optional[str] = None
    progress_pct: Optional[int] = None
    planned_pct: Optional[int] = None
    workers_count: Optional[int] = None
    work_completed: Optional[str] = None
    work_planned: Optional[str] = None
    weather: Optional[str] = None
    blockers: Optional[str] = None
    activities: List[str] = []
    safety_summary: Optional[str] = None
    materials_summary: Optional[str] = None
    days_logged: Optional[int] = None


class AssistantPPEPhotoItem(BaseModel):
    photo_id: int
    title: str
    image_url: Optional[str] = None
    created_at: Optional[str] = None
    workers_count: int = 0
    compliant_count: int = 0
    violations_count: int = 0
    compliance_pct: float = 0.0
    missing_summary: Optional[str] = None
    people: List[Dict[str, Any]] = []


class AssistantPPEViolationTypeBreakdown(BaseModel):
    item_key: str
    label: str
    count: int = 0


class AssistantPPEInfo(BaseModel):
    compliance_count: int = 0
    violations_count: int = 0
    compliance_pct: float = 100.0
    total_workers: int = 0
    total_photos: int = 0
    photos_analyzed: int = 0
    status_level: str = "CRITICAL"
    insight_summary: Optional[str] = None
    type_breakdown: List[AssistantPPEViolationTypeBreakdown] = []
    photos: List[AssistantPPEPhotoItem] = []
    violations_list: List[str] = []
    compliance_items: List[str] = []



class AssistantPipelineStep(BaseModel):
    name: str
    description: str
    icon: str


class AssistantExplainability(BaseModel):
    retrieval_mode: str = "HYBRID_RAG"
    sql_facts_count: int = 0
    semantic_chunks_count: int = 0
    risk_engine_score: int = 0
    risk_engine_level: str = "LOW"
    llm_model: str = "Gemini 2.5 Flash"
    pipeline_steps: List[AssistantPipelineStep] = []


class AssistantStructuredResponse(BaseModel):
    query_type: str = "GENERAL"
    executive_summary: str
    risk: Optional[AssistantRiskInfo] = None
    attention_items: List[AssistantAttentionItem] = []
    locations: List[AssistantLocationItem] = []
    recommended_actions: List[AssistantActionItem] = []
    materials: List[AssistantMaterialItem] = []
    progress: Optional[AssistantProgressInfo] = None
    ppe: Optional[AssistantPPEInfo] = None
    sources: List[AssistantSource] = []
    explainability: AssistantExplainability
    suggested_followups: List[str] = []


class AssistantChatResponse(BaseModel):
    project_id: int
    answer: str
    sources: List[AssistantSource] = []
    data_used: List[str] = []
    structured: Optional[AssistantStructuredResponse] = None


# ==========================================
# PHASE 8: HYBRID RAG SCHEMAS
# ==========================================

class RAGIndexResponse(BaseModel):
    status: str
    project_id: int
    project_name: str
    total_indexed: int
    breakdown: Dict[str, int] = {}


class RAGStatusResponse(BaseModel):
    project_id: int
    total_documents: int
    by_source_type: Dict[str, int] = {}
    embedding_provider: Dict[str, Any] = {}
    last_indexed_at: Optional[str] = None


class RAGSearchResultItem(BaseModel):
    doc_id: int
    project_id: int
    source_type: str
    source_id: int
    title: Optional[str] = None
    content: str
    similarity: float
    metadata: Dict[str, Any] = {}

