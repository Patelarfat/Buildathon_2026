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

## Schema & Tables (Phase 1)

### `users` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | PRIMARY KEY, AUTO_INCREMENT | Unique identifier for user |
| `name` | `VARCHAR` | NOT NULL | User's full name |
| `email` | `VARCHAR` | UNIQUE, NOT NULL, INDEXED | User email address |
| `role` | `VARCHAR` | NOT NULL | User role (e.g. admin, engineer, worker) |
| `password_hash` | `VARCHAR` | NOT NULL | Hashed password string |

## Verification Queries

To verify database connection and schema:
```sql
\c construction_intelligence
\dt
\d users
```
