# Supabase Setup

The app now uses Supabase as the project database through the existing server API. The browser talks to `server-local.js`, and `server-local.js` connects to Supabase Postgres with `DATABASE_URL`.

## 1. Create The Tables

Open Supabase Dashboard -> SQL Editor and run:

- [supabase-schema.sql](C:\Users\kasia\.gemini\antigravity\scratch\coin-system\supabase-schema.sql)

The tables are locked down for browser roles by default. That is intentional: reads and writes should go through the Node server, not directly through the public anon key.

## 2. Configure `.env`

Use Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI.

For this project, the direct connection string is enough while the app is small:

```text
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@db.tiplvmplutoybajoksat.supabase.co:5432/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

Keep these values set too:

```text
HOST=127.0.0.1
PORT=4174
PUBLIC_APP_URL=http://localhost:4174
DISCORD_OAUTH_CLIENT_ID=1492710758658871336
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are only public browser values. They are not enough for database writes in this setup.

## 3. Run Locally

```text
npm install
npm start
```

Open:

- `http://localhost:4174/`
- `http://localhost:4174/api/db-health`

Expected database health response:

```json
{
  "ok": true,
  "serverTime": "..."
}
```

## 4. Optional: Copy Existing Local Data To Supabase

If you already have data in local PostgreSQL, use the migration script after the Supabase schema exists.

Set these values in `.env` or in the terminal:

```text
SOURCE_DATABASE_URL=postgres://postgres:YOUR_LOCAL_PASSWORD@localhost:5432/coin_system
SUPABASE_DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@db.tiplvmplutoybajoksat.supabase.co:5432/postgres
SUPABASE_DATABASE_SSL=true
CONFIRM_MIGRATION=copy-to-supabase
```

Then run:

```text
npm run migrate:supabase
```

The script replaces data in the target Supabase tables, so use it only when Supabase should become a copy of the source database.

## Notes

- The app still stores one full snapshot through `/api/snapshot`, but the snapshot is persisted into real Supabase tables.
- The server automatically enables SSL for Supabase-style connection strings.
- If you later host the Node server somewhere else, set `HOST=0.0.0.0` and update `PUBLIC_APP_URL`.
