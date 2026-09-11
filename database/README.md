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
| `role` | `VARCHAR(50)` | NOT NULL | PROJECT_MANAGER, SITE_SUPERVISOR, SAFETY_OFFICER, CONTRACTOR, ADMIN |
| `joined_at` | `TIMESTAMP` | NOT NULL, AUTO | Membership assignment timestamp |

*Constraint: Unique on `(project_id, user_id)` to prevent duplicate memberships.*

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
```
