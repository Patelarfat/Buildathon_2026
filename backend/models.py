from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)

    project_memberships = relationship(
        "ProjectMember",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    photos = relationship("SitePhoto", back_populates="uploader", cascade="all, delete-orphan")
    daily_reports = relationship("DailyReport", back_populates="reporter", cascade="all, delete-orphan")
    safety_incidents = relationship("SafetyIncident", back_populates="reporter", cascade="all, delete-orphan")
    inspections = relationship("InspectionReport", back_populates="inspector", cascade="all, delete-orphan")
    observations_created = relationship("Observation", foreign_keys="Observation.created_by", back_populates="creator", cascade="all, delete-orphan")
    observations_assigned = relationship("Observation", foreign_keys="Observation.assigned_to", back_populates="assignee")
    materials_recorded = relationship("Material", back_populates="recorder", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="PLANNING")
    start_date = Column(String(50), nullable=True)
    end_date = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    sites = relationship(
        "Site",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Site.id"
    )
    members = relationship(
        "ProjectMember",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="ProjectMember.id"
    )
    photos = relationship("SitePhoto", back_populates="project", cascade="all, delete-orphan", order_by="SitePhoto.id.desc()")
    daily_reports = relationship("DailyReport", back_populates="project", cascade="all, delete-orphan", order_by="DailyReport.id.desc()")
    safety_incidents = relationship("SafetyIncident", back_populates="project", cascade="all, delete-orphan", order_by="SafetyIncident.id.desc()")
    inspections = relationship("InspectionReport", back_populates="project", cascade="all, delete-orphan", order_by="InspectionReport.id.desc()")
    observations = relationship("Observation", back_populates="project", cascade="all, delete-orphan", order_by="Observation.id.desc()")
    materials = relationship("Material", back_populates="project", cascade="all, delete-orphan", order_by="Material.id.desc()")


class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    project = relationship("Project", back_populates="sites")
    areas = relationship(
        "Area",
        back_populates="site",
        cascade="all, delete-orphan",
        order_by="Area.id"
    )
    photos = relationship("SitePhoto", back_populates="site", cascade="all, delete-orphan")
    daily_reports = relationship("DailyReport", back_populates="site", cascade="all, delete-orphan")
    safety_incidents = relationship("SafetyIncident", back_populates="site", cascade="all, delete-orphan")
    inspections = relationship("InspectionReport", back_populates="site", cascade="all, delete-orphan")
    observations = relationship("Observation", back_populates="site", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="site", cascade="all, delete-orphan")


class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(
        Integer,
        ForeignKey("sites.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    name = Column(String(255), nullable=False)
    area_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    site = relationship("Site", back_populates="areas")
    photos = relationship("SitePhoto", back_populates="area")
    daily_reports = relationship("DailyReport", back_populates="area")
    safety_incidents = relationship("SafetyIncident", back_populates="area")
    inspections = relationship("InspectionReport", back_populates="area")
    observations = relationship("Observation", back_populates="area")
    materials = relationship("Material", back_populates="area")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role = Column(String(50), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_user"),
    )

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


# ==========================================
# PHASE 3: FIELD DATA COLLECTION MODELS
# ==========================================

class SitePhoto(Base):
    __tablename__ = "site_photos"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    caption = Column(Text, nullable=True)
    taken_at = Column(String(50), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="photos")
    site = relationship("Site", back_populates="photos")
    area = relationship("Area", back_populates="photos")
    uploader = relationship("User", back_populates="photos")


class DailyReport(Base):
    __tablename__ = "daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True)
    reported_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    report_date = Column(String(50), nullable=False)
    work_completed = Column(Text, nullable=True)
    work_planned = Column(Text, nullable=True)
    progress_percentage = Column(Integer, nullable=True)
    workers_count = Column(Integer, nullable=True)
    weather = Column(String(255), nullable=True)
    equipment_used = Column(Text, nullable=True)
    materials_used = Column(Text, nullable=True)
    issues = Column(Text, nullable=True)
    blockers = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="daily_reports")
    site = relationship("Site", back_populates="daily_reports")
    area = relationship("Area", back_populates="daily_reports")
    reporter = relationship("User", back_populates="daily_reports")


class SafetyIncident(Base):
    __tablename__ = "safety_incidents"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True)
    reported_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    incident_date = Column(String(50), nullable=False)
    incident_type = Column(String(50), nullable=False)
    severity = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    action_taken = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="OPEN")
    resolved_at = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="safety_incidents")
    site = relationship("Site", back_populates="safety_incidents")
    area = relationship("Area", back_populates="safety_incidents")
    reporter = relationship("User", back_populates="safety_incidents")


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True)
    inspector_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    inspection_date = Column(String(50), nullable=False)
    inspection_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="OPEN")
    findings = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="inspections")
    site = relationship("Site", back_populates="inspections")
    area = relationship("Area", back_populates="inspections")
    inspector = relationship("User", back_populates="inspections")


class Observation(Base):
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    observation_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(50), nullable=False, default="MEDIUM")
    status = Column(String(50), nullable=False, default="OPEN")
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    observed_at = Column(String(50), nullable=True)
    resolved_at = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="observations")
    site = relationship("Site", back_populates="observations")
    area = relationship("Area", back_populates="observations")
    creator = relationship("User", foreign_keys=[created_by], back_populates="observations_created")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="observations_assigned")


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True, index=True)
    recorded_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    material_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=False, default=0.0)
    unit = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="ORDERED")
    supplier = Column(String(255), nullable=True)
    delivery_date = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="materials")
    site = relationship("Site", back_populates="materials")
    area = relationship("Area", back_populates="materials")
    recorder = relationship("User", back_populates="materials_recorded")
