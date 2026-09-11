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
```

