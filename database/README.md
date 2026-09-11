# PostgreSQL Database Setup & Documentation

## Database Information
- **Database Name:** `construction_intelligence`
- **Default Host:** `localhost`
- **Default Port:** `5432`
- **Default User:** `postgres`

## Setup Instructions

1. **Verify PostgreSQL is running:**
   ```bash
   psql -U postgres
   ```

2. **Create Database (if not exists):**
   ```sql
   CREATE DATABASE construction_intelligence;
   ```

3. **Configure Environment Variables:**
   Create a `.env` file inside `backend/`:
   ```env
   DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/construction_intelligence
   ```

---

## Schema & Tables (Phase 2 Entities)

### 1. `users` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for user |
| `name` | `VARCHAR(255)` | NOT NULL | User's full name |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL, INDEXED | User email address |
| `role` | `VARCHAR(50)` | NOT NULL | User system role |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Hashed password string |

### 2. `projects` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for project |
| `name` | `VARCHAR(255)` | NOT NULL | Project name |
| `description` | `TEXT` | NULLABLE | Project scope and description |
| `location` | `VARCHAR(255)` | NULLABLE | Geographic location / address |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'PLANNING' | PLANNING, ACTIVE, ON_HOLD, COMPLETED |
| `start_date` | `VARCHAR(50)` | NULLABLE | Planned start date |
| `end_date` | `VARCHAR(50)` | NULLABLE | Target completion date |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Record last updated timestamp |

### 3. `sites` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for site |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Parent project ID |
| `name` | `VARCHAR(255)` | NOT NULL | Site name (e.g. Main Construction Site) |
| `address` | `VARCHAR(255)` | NULLABLE | Physical site address |
| `description` | `TEXT` | NULLABLE | Site details & notes |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Last updated timestamp |

### 4. `areas` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for area |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Parent site ID |
| `name` | `VARCHAR(255)` | NOT NULL | Area / zone name (e.g. Floor 1, North Wing) |
| `area_type` | `VARCHAR(100)` | NULLABLE | Type: FLOOR, BUILDING, WING, WAREHOUSE, etc. |
| `description` | `TEXT` | NULLABLE | Area scope and description |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Last updated timestamp |

### 5. `project_members` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for membership |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `user_id` | `INTEGER` | FOREIGN KEY (users.id ON DELETE CASCADE), NOT NULL | Assigned User ID |
| `role` | `VARCHAR(50)` | NOT NULL | Role on this project |
| `joined_at` | `TIMESTAMP` | NOT NULL, AUTO | Membership assignment timestamp |

*Constraint: Unique on `(project_id, user_id)` to prevent duplicate memberships.*

---

## Schema & Tables (Phase 3 Field Data Collection Entities)

### 6. `site_photos` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for photo |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional Area ID |
| `uploaded_by` | `INTEGER` | FOREIGN KEY (users.id ON DELETE RESTRICT), NOT NULL | Uploader User ID |
| `file_name` | `VARCHAR(255)` | NOT NULL | Original filename |
| `file_path` | `VARCHAR(500)` | NOT NULL | Web path (`/uploads/photos/...`) |
| `caption` | `TEXT` | NULLABLE | Description / caption |
| `taken_at` | `VARCHAR(50)` | NULLABLE | Capture timestamp |
| `latitude` | `FLOAT` | NULLABLE | GPS latitude |
| `longitude` | `FLOAT` | NULLABLE | GPS longitude |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Upload timestamp |

### 7. `daily_reports` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for report |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional Area ID |
| `reported_by` | `INTEGER` | FOREIGN KEY (users.id ON DELETE RESTRICT), NOT NULL | Supervisor User ID |
| `report_date` | `VARCHAR(50)` | NOT NULL | Date of daily report (YYYY-MM-DD) |
| `work_completed` | `TEXT` | NULLABLE | Work executed today |
| `work_planned` | `TEXT` | NULLABLE | Planned work for tomorrow |
| `progress_percentage` | `INTEGER` | NULLABLE (0-100) | Overall progress estimate |
| `workers_count` | `INTEGER` | NULLABLE | Headcount on site |
| `weather` | `VARCHAR(100)` | NULLABLE | Weather conditions |
| `equipment_used` | `TEXT` | NULLABLE | Machinery and heavy equipment |
| `materials_used` | `TEXT` | NULLABLE | Material consumption notes |
| `issues` | `TEXT` | NULLABLE | Issues or delays |
| `blockers` | `TEXT` | NULLABLE | Critical bottlenecks |
| `notes` | `TEXT` | NULLABLE | General notes |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Update timestamp |

### 8. `safety_incidents` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for incident |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional Area ID |
| `reported_by` | `INTEGER` | FOREIGN KEY (users.id ON DELETE RESTRICT), NOT NULL | Safety Officer User ID |
| `incident_date` | `VARCHAR(50)` | NOT NULL | Incident date/time |
| `incident_type` | `VARCHAR(50)` | NOT NULL | PPE_VIOLATION, FALL, INJURY, EQUIPMENT_ACCIDENT, UNSAFE_BEHAVIOR, UNSAFE_CONDITION, OTHER |
| `severity` | `VARCHAR(50)` | NOT NULL | LOW, MEDIUM, HIGH, CRITICAL |
| `description` | `TEXT` | NOT NULL | Incident description |
| `action_taken` | `TEXT` | NULLABLE | Corrective action taken |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'OPEN' | OPEN, UNDER_REVIEW, RESOLVED |
| `resolved_at` | `VARCHAR(50)` | NULLABLE | Resolution date |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Update timestamp |

### 9. `inspection_reports` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for inspection |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional Area ID |
| `inspector_id` | `INTEGER` | FOREIGN KEY (users.id ON DELETE RESTRICT), NOT NULL | Inspector User ID |
| `inspection_date` | `VARCHAR(50)` | NOT NULL | Inspection date |
| `inspection_type` | `VARCHAR(50)` | NOT NULL | SAFETY, QUALITY, EQUIPMENT, ENVIRONMENTAL, GENERAL |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'OPEN' | OPEN, PASSED, FAILED, REQUIRES_ACTION |
| `findings` | `TEXT` | NULLABLE | Observations and findings |
| `recommendations` | `TEXT` | NULLABLE | Required recommendations |
| `notes` | `TEXT` | NULLABLE | Notes |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Update timestamp |

### 10. `observations` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for observation |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional Area ID |
| `created_by` | `INTEGER` | FOREIGN KEY (users.id ON DELETE RESTRICT), NOT NULL | Creator User ID |
| `observation_type` | `VARCHAR(50)` | NOT NULL | PROGRESS, SAFETY, QUALITY, MATERIAL, EQUIPMENT, GENERAL |
| `title` | `VARCHAR(255)` | NOT NULL | Issue title |
| `description` | `TEXT` | NOT NULL | Detailed observation note |
| `priority` | `VARCHAR(50)` | NOT NULL, DEFAULT 'MEDIUM' | LOW, MEDIUM, HIGH |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'OPEN' | OPEN, IN_PROGRESS, RESOLVED |
| `assigned_to` | `INTEGER` | FOREIGN KEY (users.id ON DELETE SET NULL), NULLABLE | Assigned User ID |
| `observed_at` | `VARCHAR(50)` | NULLABLE | Observation timestamp |
| `resolved_at` | `VARCHAR(50)` | NULLABLE | Resolution timestamp |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Update timestamp |

### 11. `materials` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for material item |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional Area ID |
| `recorded_by` | `INTEGER` | FOREIGN KEY (users.id ON DELETE RESTRICT), NOT NULL | User ID who logged delivery |
| `material_name` | `VARCHAR(255)` | NOT NULL | Material name (e.g. Concrete, Rebar) |
| `category` | `VARCHAR(100)` | NULLABLE | Category (e.g. Steel, Cement, Electrical) |
| `quantity` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Logged quantity |
| `unit` | `VARCHAR(50)` | NOT NULL | Measurement unit (tons, bags, m3, pcs) |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'ORDERED' | ORDERED, DELIVERED, IN_USE, LOW_STOCK |
| `supplier` | `VARCHAR(255)` | NULLABLE | Vendor or supplier name |
| `delivery_date` | `VARCHAR(50)` | NULLABLE | Delivery date |
| `notes` | `TEXT` | NULLABLE | Batch notes, certificates |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Update timestamp |

---

## Schema & Tables (Phase 4 AI Computer Vision Entities)

### 12. `ai_analysis_runs` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for AI inference run |
| `photo_id` | `INTEGER` | FOREIGN KEY (site_photos.id ON DELETE CASCADE), NOT NULL | Analyzed site photo ID |
| `model_name` | `VARCHAR(100)` | NOT NULL | YOLO model architecture name (`yolo11n-ppe-finetuned`) |
| `model_version` | `VARCHAR(50)` | NOT NULL | Model version tag (`v1.0.0-finetuned-construction-ppe`) |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'PROCESSING' | PROCESSING, COMPLETED, FAILED |
| `processing_time_ms` | `FLOAT` | NULLABLE | Inference and post-processing latency in milliseconds |
| `annotated_file_path` | `VARCHAR(500)` | NULLABLE | Web URL path to bounding-box annotated image (`/uploads/ai/...`) |
| `error_message` | `TEXT` | NULLABLE | Error trace if run failed |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Run creation timestamp |

### 13. `ai_detections` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for detected object |
| `photo_id` | `INTEGER` | FOREIGN KEY (site_photos.id ON DELETE CASCADE), NOT NULL | Site photo ID |
| `analysis_run_id` | `INTEGER` | FOREIGN KEY (ai_analysis_runs.id ON DELETE CASCADE), NOT NULL | Parent AI run ID |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Inherited project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Inherited site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Inherited area ID |
| `class_id` | `INTEGER` | NOT NULL | YOLO class index (0-10) |
| `class_name` | `VARCHAR(100)` | NOT NULL | YOLO class label (Person, helmet, vest, boots, etc.) |
| `confidence` | `FLOAT` | NOT NULL | Model prediction confidence score (0.00 to 1.00) |
| `bbox_x_min` | `FLOAT` | NOT NULL | Normalized bounding box x_min (0.0 to 1.0) |
| `bbox_y_min` | `FLOAT` | NOT NULL | Normalized bounding box y_min (0.0 to 1.0) |
| `bbox_x_max` | `FLOAT` | NOT NULL | Normalized bounding box x_max (0.0 to 1.0) |
| `bbox_y_max` | `FLOAT` | NOT NULL | Normalized bounding box y_max (0.0 to 1.0) |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Detection timestamp |

### 14. `ai_safety_findings` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for AI safety finding |
| `photo_id` | `INTEGER` | FOREIGN KEY (site_photos.id ON DELETE CASCADE), NOT NULL | Site photo ID |
| `analysis_run_id` | `INTEGER` | FOREIGN KEY (ai_analysis_runs.id ON DELETE CASCADE), NOT NULL | AI analysis run ID |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Inherited project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Inherited site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Inherited area ID |
| `finding_type` | `VARCHAR(100)` | NOT NULL | NO_HELMET, NO_VEST, NO_GLOVES, NO_BOOTS, NO_GOGGLES, PPE_COMPLIANT, etc. |
| `severity` | `VARCHAR(50)` | NOT NULL | INFO, LOW, MEDIUM, HIGH, CRITICAL |
| `title` | `VARCHAR(255)` | NOT NULL | Finding title summary |
| `description` | `TEXT` | NOT NULL | Detailed context and observations |
| `confidence` | `FLOAT` | NOT NULL | Detection confidence score |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'OPEN' | Human review status: OPEN, REVIEWED, RESOLVED, FALSE_POSITIVE |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Finding creation timestamp |

---

## Schema & Tables (Phase 5 Construction Intelligence Entities)

### 15. `risk_assessments` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for assessment run |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Evaluated project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NULLABLE | Optional site filter |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Optional area filter |
| `assessment_date` | `VARCHAR(50)` | NOT NULL | Date stamp of assessment (YYYY-MM-DD) |
| `time_window_days` | `INTEGER` | NOT NULL, DEFAULT 7 | Evaluated lookback window (1, 7, 30 days) |
| `risk_score` | `INTEGER` | NOT NULL | Clamped 0-100 score |
| `risk_level` | `VARCHAR(50)` | NOT NULL | LOW (0-24), MEDIUM (25-49), HIGH (50-74), CRITICAL (75-100) |
| `ai_findings_score` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Capped AI sub-score (max 30) |
| `incident_score` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Capped human incident sub-score (max 30) |
| `observation_score` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Capped observation sub-score (max 15) |
| `inspection_score` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Capped inspection sub-score (max 15) |
| `recurring_issue_score` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Capped recurring issue sub-score (max 15) |
| `trend_score` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Trend adjustment (+10, 0, -5) |
| `data_confidence` | `VARCHAR(50)` | NOT NULL, DEFAULT 'HIGH' | Record volume reliability (LOW, MEDIUM, HIGH) |
| `calculated_at` | `TIMESTAMP` | NOT NULL, AUTO | Calculation timestamp |

### 16. `risk_reasons` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for explanation reason |
| `risk_assessment_id` | `INTEGER` | FOREIGN KEY (risk_assessments.id ON DELETE CASCADE), NOT NULL | Parent assessment |
| `reason_type` | `VARCHAR(100)` | NOT NULL | SAFETY_INDICATOR, RECURRING, TREND, GENERAL |
| `message` | `TEXT` | NOT NULL | Specific plain-text explanatory reason |
| `impact_points` | `FLOAT` | NOT NULL, DEFAULT 0.0 | Point contribution |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |

### 17. `recurring_issues` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for recurring issue alert |
| `project_id` | `INTEGER` | FOREIGN KEY (projects.id ON DELETE CASCADE), NOT NULL | Project ID |
| `site_id` | `INTEGER` | FOREIGN KEY (sites.id ON DELETE CASCADE), NOT NULL | Site ID |
| `area_id` | `INTEGER` | FOREIGN KEY (areas.id ON DELETE SET NULL), NULLABLE | Area ID |
| `issue_type` | `VARCHAR(100)` | NOT NULL | Specific issue code (e.g. NO_HELMET, PPE_VIOLATION) |
| `issue_category` | `VARCHAR(100)` | NOT NULL | AI_PPE, SAFETY_INCIDENT, OBSERVATION, INSPECTION, MATERIAL |
| `occurrence_count` | `INTEGER` | NOT NULL, DEFAULT 1 | Count of occurrences in window |
| `first_seen` | `VARCHAR(50)` | NOT NULL | First occurrence date/timestamp |
| `last_seen` | `VARCHAR(50)` | NOT NULL | Most recent occurrence date/timestamp |
| `time_window_days` | `INTEGER` | NOT NULL, DEFAULT 7 | Evaluation window |
| `severity` | `VARCHAR(50)` | NOT NULL | LOW, MEDIUM, HIGH, CRITICAL |
| `status` | `VARCHAR(50)` | NOT NULL, DEFAULT 'ACTIVE' | ACTIVE, RESOLVED, ACKNOWLEDGED |
| `created_at` | `TIMESTAMP` | NOT NULL, AUTO | Creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL, AUTO | Update timestamp |

---

## Verification Queries

To verify database connection and schema:
```sql
\c construction_intelligence
\dt
\d users
\d projects
\d sites
\d areas
\d project_members
\d site_photos
\d daily_reports
\d safety_incidents
\d inspection_reports
\d observations
\d materials
\d ai_analysis_runs
\d ai_detections
\d ai_safety_findings
\d risk_assessments
\d risk_reasons
\d recurring_issues
```


