**Database Setup**

The project now targets Supabase Postgres by default.

Use this guide for Supabase:

- [SUPABASE_SETUP.md](C:\Users\kasia\.gemini\antigravity\scratch\coin-system\SUPABASE_SETUP.md)

Local PostgreSQL can still be used for development. In that case, keep using:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/coin_system
DATABASE_SSL=false
```

Run the local schema with:

- [postgres-local-schema.sql](C:\Users\kasia\.gemini\antigravity\scratch\coin-system\postgres-local-schema.sql)

Expected local URL:

- `http://localhost:4174/`

Useful endpoints:

- `/api/health`
- `/api/db-health`
- `/api/snapshot`
