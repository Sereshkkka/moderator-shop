# VPS Deploy

Use this when deploying the project to a VPS with Docker Compose.

## 1. Prepare files

Clone the repository on the VPS:

```bash
git clone https://github.com/Sereshkkka/moderator-shop.git
cd moderator-shop
```

Create `.env` from the VPS example:

```bash
cp vps.env.example .env
```

Edit `.env` and replace only these values:

```text
PUBLIC_APP_URL=https://YOUR_DOMAIN_OR_SERVER_IP
DATABASE_URL=postgresql://postgres:YOUR_DATABASE_PASSWORD@db.tiplvmplutoybajoksat.supabase.co:5432/postgres
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Known values are already filled in:

```text
HOST=0.0.0.0
PORT=4174
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
DISCORD_OAUTH_CLIENT_ID=1492710758658871336
SUPABASE_URL=https://tiplvmplutoybajoksat.supabase.co
```

## 2. Start

```bash
docker compose up -d --build
```

The app will listen on port `4174`:

```text
http://YOUR_SERVER_IP:4174
```

## 3. Update

```bash
git pull
docker compose up -d --build
```

## 4. Check logs

```bash
docker compose logs -f modshop
```
