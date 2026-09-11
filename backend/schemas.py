from datetime import datetime
from typing import Optional, List
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
