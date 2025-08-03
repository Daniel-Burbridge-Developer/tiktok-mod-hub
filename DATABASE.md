# Database Setup

This project uses SQLite with Drizzle ORM for data persistence.

## Initial Setup

1. **Initialize the database:**

   ```bash
   pnpm db:init
   ```

2. **Push schema changes (if needed):**
   ```bash
   pnpm db:push
   ```

## Database Management

- **View data:** `pnpm db:studio` (opens Drizzle Studio at https://local.drizzle.studio)
- **Database location:** `db/events.sqlite`

## Database Schema

### Tables

- **`job_control`** - Controls background job status
  - `id` (primary key)
  - `status` (enum: "started" | "stopped")

- **`events`** - Logs background job events
  - `id` (auto-increment primary key)
  - `timestamp` (ISO string)
  - `message` (text)

## Development

The database is automatically created when you run:

- `pnpm dev` - Starts both web app and worker
- `pnpm db:init` - Manually initialize database

## Production Considerations

- The database file is gitignored for security
- Consider using environment variables for database path in production
- For production, consider using a more robust database like PostgreSQL
