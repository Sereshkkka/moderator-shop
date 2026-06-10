# Render Deploy

Create a Render **Web Service** from this repository.

Use these settings:

```text
Runtime: Docker
Plan: Free
```

Do not upload a real `.env` file to GitHub. Add these values in Render under **Environment Variables**:

```text
HOST=0.0.0.0
PUBLIC_APP_URL=https://YOUR_RENDER_SERVICE.onrender.com
DATABASE_URL=postgresql://postgres.tiplvmplutoybajoksat:YOUR_DATABASE_PASSWORD@aws-1-us-west-2.pooler.supabase.com:6543/postgres
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
DATABASE_CONNECTION_TIMEOUT_MS=10000
DISCORD_OAUTH_CLIENT_ID=1492710758658871336
SUPABASE_URL=https://tiplvmplutoybajoksat.supabase.co
SUPABASE_ANON_KEY=
```

Leave `PORT` unset on Render. Render provides it automatically.

After deploy, check:

```text
https://YOUR_RENDER_SERVICE.onrender.com/api/health
https://YOUR_RENDER_SERVICE.onrender.com/api/db-health
```

Both should return `ok: true`.

If Discord login or linking is used, add this redirect URL in Discord Developer Portal:

```text
https://YOUR_RENDER_SERVICE.onrender.com/
```
