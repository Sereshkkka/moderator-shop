# Seamless VPS PostgreSQL Migration

This migration keeps the website on Supabase while the local PostgreSQL container is prepared and populated. Cutover happens only after row-count verification succeeds.

## 1. Update The Project

```bash
cd ~/moderator-shop
git pull
```

## 2. Add Local Database Settings

Generate a database password containing only URL-safe hexadecimal characters:

```bash
openssl rand -hex 24
```

Open the environment file:

```bash
nano .env
```

Add these lines without changing the current Supabase `DATABASE_URL` yet:

```text
POSTGRES_DB=modshop
POSTGRES_USER=modshop
POSTGRES_PASSWORD=PASTE_THE_GENERATED_PASSWORD_HERE
```

Save with `Ctrl+O`, `Enter`, then exit with `Ctrl+X`.

## 3. Start Local PostgreSQL

The website continues using Supabase during this step.

```bash
docker compose up -d postgres
docker compose ps
```

Wait until `modshop-postgres` reports `healthy`.

## 4. Copy And Verify Supabase Data

```bash
docker compose run --rm \
  -e CONFIRM_POSTGRES_COPY=copy-postgres-data \
  modshop npm run migrate:postgres
```

The final line must be:

```text
Migration completed and row counts verified.
```

If the command fails, do not change `DATABASE_URL`; the running website remains on Supabase.

## 5. Switch The Website

Open `.env` again:

```bash
nano .env
```

Keep the old Supabase URL as a comment for rollback and replace the active database settings:

```text
# SUPABASE_DATABASE_URL_BACKUP=postgresql://OLD_SUPABASE_CONNECTION_STRING
DATABASE_URL=postgresql://modshop:THE_GENERATED_PASSWORD@postgres:5432/modshop
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

Apply the cutover:

```bash
docker compose up -d --build
curl -s https://moderator-shop.mtechlab.dev/api/db-health
```

Expected response contains `"ok":true`.

## 6. Verify The Site

Check login, employees, roles, store products, transactions, Discord links, and image uploads. Keep the Supabase project unchanged for at least several days as a rollback source.

## Rollback

Restore the old Supabase `DATABASE_URL` and SSL settings in `.env`, then run:

```bash
docker compose up -d --build modshop
```

## Backups

Create a backup manually:

```bash
chmod +x scripts/backup-postgres.sh
./scripts/backup-postgres.sh
```

Backups are stored in `data/backups` and retained for 14 days by default.

For a daily backup at 04:15 UTC:

```bash
crontab -e
```

Add:

```text
15 4 * * * cd /root/moderator-shop && /bin/sh scripts/backup-postgres.sh >> data/backups/backup.log 2>&1
```
