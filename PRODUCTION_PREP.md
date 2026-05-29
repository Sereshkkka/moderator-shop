# Production Prep

The project is ready to use Supabase Postgres through the Node server.

What is already prepared:

1. Browser configuration is served from `/app-config.js`.
2. Discord OAuth can use `PUBLIC_APP_URL` instead of hardcoded localhost.
3. Database access goes through `server-local.js`, not directly through the browser.
4. Supabase Postgres SSL is supported through `DATABASE_SSL=true`.
5. The Supabase schema is in [supabase-schema.sql](C:\Users\kasia\.gemini\antigravity\scratch\coin-system\supabase-schema.sql).

Before deploying:

1. Run [supabase-schema.sql](C:\Users\kasia\.gemini\antigravity\scratch\coin-system\supabase-schema.sql) in Supabase SQL Editor.
2. Create `.env` on the server using [.env.example](C:\Users\kasia\.gemini\antigravity\scratch\coin-system\.env.example).
3. Fill these values:
   - `HOST=0.0.0.0`
   - `PORT`
   - `PUBLIC_APP_URL=https://your-domain.com`
   - `DATABASE_URL`
   - `DATABASE_SSL=true`
   - `DISCORD_OAUTH_CLIENT_ID`
4. In Discord Developer Portal, replace the redirect URL:
   - from `http://localhost:4174/`
   - to `https://your-domain.com/`
5. Start the server:

```text
npm install
npm start
```

Useful checks:

- `/api/health`
- `/api/db-health`

Important security note:

- Do not expose the Supabase database password in browser code.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are public values only.
- The current production-safe path is browser -> Node server -> Supabase Postgres.
