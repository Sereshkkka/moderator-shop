const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '.env') });

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4174);
const DATABASE_URL = process.env.DATABASE_URL || '';
const DATABASE_SSL = String(process.env.DATABASE_SSL || '').toLowerCase();
const DATABASE_SSL_REJECT_UNAUTHORIZED = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`;
const DISCORD_OAUTH_CLIENT_ID = process.env.DISCORD_OAUTH_CLIENT_ID || '1492710758658871336';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const ROOT = __dirname;
const DEFAULT_AVATAR_URL_TEMPLATE = 'https://skins.mcskill.net/?name=insert&mode=5&fx=size&fy=size';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function shouldUseDatabaseSsl(connectionString) {
  if (!connectionString) return false;
  if (['1', 'true', 'yes', 'require'].includes(DATABASE_SSL)) return true;
  if (['0', 'false', 'no', 'disable'].includes(DATABASE_SSL)) return false;
  return /supabase\.(co|com)|pooler\.supabase\.com/i.test(connectionString);
}

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: shouldUseDatabaseSsl(DATABASE_URL)
        ? { rejectUnauthorized: DATABASE_SSL_REJECT_UNAUTHORIZED }
        : undefined
    })
  : null;

function mapRoleRow(row) {
  return {
    id: row.id,
    label: row.label,
    tier: row.tier,
    color: row.color,
    perms: Array.isArray(row.perms) ? row.perms : []
  };
}

function mapCompanyRow(row) {
  return {
    id: row.id,
    name: row.name,
    accentColor: row.accent_color || '#8b5cf6',
    webhookUrl: row.webhook_url || ''
  };
}

function mapUserRow(row, accessRows) {
  const companyAccess = accessRows
    .filter((entry) => entry.user_id === row.id)
    .map((entry) => entry.company_id);
  const accessList = companyAccess.length ? companyAccess : [row.company_id];
  const companyRoles = row.server_roles && typeof row.server_roles === 'object'
    ? { ...row.server_roles }
    : {};
  const reprimands = row.reprimands && typeof row.reprimands === 'object'
    ? { ...row.reprimands }
    : {};
  accessList.forEach((companyId) => {
    if (!companyRoles[companyId]) {
      companyRoles[companyId] = row.role_id;
    }
  });

  return {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    coins: row.coins || 0,
    role: row.role_id,
    companyId: row.company_id,
    date: row.created_at,
    cart: Array.isArray(row.cart) ? row.cart : [],
    isArchived: !!row.is_archived,
    isPendingActivation: !!row.is_pending_activation,
    mustChangePassword: !!row.must_change_password,
    accountStatus: row.account_status || 'активен',
    discordId: row.discord_id || '',
    discordUsername: row.discord_username || '',
    discordAvatarUrl: row.discord_avatar_url || '',
    inviteCodeId: row.invite_code_id || null,
    authorizedCompanies: accessList,
    companyRoles,
    reprimands
  };
}

function mapCodeRow(row) {
  return {
    id: row.id,
    code: row.code,
    companyId: row.company_id,
    targetUsername: row.target_username,
    isUsed: !!row.is_used,
    createdBy: row.created_by || null,
    date: row.created_at
  };
}

function mapItemRow(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description || '',
    price: row.price || 0,
    itemType: row.item_type || 'item',
    image: row.image || ''
  };
}

function mapLogRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    modifierId: row.modifier_id,
    companyId: row.company_id,
    oldBalance: row.old_balance || 0,
    newBalance: row.new_balance || 0,
    type: row.type,
    reason: row.reason || '',
    date: row.created_at,
    purchaseDetails: row.purchase_details || null
  };
}

function mapSystemConfigRow(row) {
  return {
    webhookUrl: row && row.webhook_url ? row.webhook_url : '',
    avatarUrlTemplate: row && row.avatar_url_template ? row.avatar_url_template : DEFAULT_AVATAR_URL_TEMPLATE
  };
}

function buildSnapshot(rows) {
  return {
    users: rows.users.map((row) => mapUserRow(row, rows.access)),
    codes: rows.codes.map(mapCodeRow),
    items: rows.items.map(mapItemRow),
    logs: rows.logs.map(mapLogRow),
    roles: rows.roles.map(mapRoleRow),
    companies: rows.companies.map(mapCompanyRow),
    systemConfig: mapSystemConfigRow(rows.systemConfig[0] || null),
    _lastSavedAt: new Date().toISOString()
  };
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function getPublicAppConfig() {
  return {
    publicAppUrl: PUBLIC_APP_URL,
    discordOAuthClientId: DISCORD_OAUTH_CLIENT_ID,
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY
  };
}

function normalizeDiscordId(value) {
  return String(value || '').replace(/[<@!>\s]/g, '').trim();
}

function buildPurchaseMentionRoleTargets(itemTypes) {
  const targets = new Set();
  (Array.isArray(itemTypes) ? itemTypes : []).forEach((itemType) => {
    if (itemType === 'donate') {
      targets.add('kurator');
      targets.add('server_admin');
    } else {
      targets.add('ST-moderator');
      targets.add('GM');
    }
  });
  return targets;
}

async function buildServerSideMentionText(companyId, itemTypes) {
  if (!pool || !companyId) return '';

  const roleTargets = buildPurchaseMentionRoleTargets(itemTypes);
  if (!roleTargets.size) return '';

  const snapshot = await fetchSnapshotFromDatabase();
  const mentionIds = [];

  snapshot.users
    .filter((user) => {
      if (!user || user.isArchived) return false;
      const scopedRole = user.role === 'admin'
        ? 'admin'
        : (user.companyRoles && user.companyRoles[companyId]) || user.role;
      if (!roleTargets.has(scopedRole)) return false;
      if (user.companyId === companyId) return true;
      return Array.isArray(user.authorizedCompanies) && user.authorizedCompanies.includes(companyId);
    })
    .forEach((user) => {
      const discordId = normalizeDiscordId(user.discordId);
      if (discordId && !mentionIds.includes(discordId)) {
        mentionIds.push(discordId);
      }
    });

  return mentionIds.map((discordId) => `<@${discordId}>`).join(' ');
}

function uniqueBy(items, keyBuilder) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyBuilder(item);
    if (!key) continue;
    map.set(key, item);
  }
  return Array.from(map.values());
}

async function fetchSnapshotFromDatabase() {
  const [companies, roles, users, access, codes, items, logs, systemConfig] = await Promise.all([
    pool.query('select * from companies order by created_at asc, id asc'),
    pool.query('select * from roles order by tier asc, id asc'),
    pool.query('select * from users order by created_at asc, id asc'),
    pool.query('select * from user_company_access order by user_id asc, company_id asc'),
    pool.query('select * from codes order by created_at asc, id asc'),
    pool.query('select * from items order by created_at asc, id asc'),
    pool.query('select * from logs order by created_at asc, id asc'),
    pool.query('select * from system_config limit 1')
  ]);

  return buildSnapshot({
    companies: companies.rows,
    roles: roles.rows,
    users: users.rows,
    access: access.rows,
    codes: codes.rows,
    items: items.rows,
    logs: logs.rows,
    systemConfig: systemConfig.rows
  });
}

async function ensureDatabaseCompat() {
  if (!pool) return;
  await pool.query(`
    alter table if exists companies
    add column if not exists accent_color text not null default '#8b5cf6'
  `);
  await pool.query(`
    alter table if exists roles
    alter column tier type numeric using tier::numeric
  `);
  await pool.query(`
    alter table if exists users
    add column if not exists server_roles jsonb not null default '{}'::jsonb
  `);
  await pool.query(`
    alter table if exists users
    add column if not exists reprimands jsonb not null default '{}'::jsonb
  `);
  await pool.query(`
    alter table if exists logs
    add column if not exists purchase_details jsonb null
  `);
  await pool.query(`
    alter table if exists system_config
    add column if not exists avatar_url_template text not null default '${DEFAULT_AVATAR_URL_TEMPLATE}'
  `);
}

async function saveSnapshotToDatabase(snapshot) {
  const client = await pool.connect();
  try {
    const companies = uniqueBy(snapshot.companies || [], (item) => item.id);
    const roles = uniqueBy(snapshot.roles || [], (item) => item.id);
    const users = uniqueBy(snapshot.users || [], (item) => item.id || item.username);
    const codes = uniqueBy(snapshot.codes || [], (item) => item.id || item.code);
    const items = uniqueBy(snapshot.items || [], (item) => item.id);
    const logs = uniqueBy(snapshot.logs || [], (item) => item.id);

    await client.query('begin');

    await client.query('delete from user_company_access');
    await client.query('delete from logs');
    await client.query('delete from items');
    await client.query('delete from codes');
    await client.query('delete from users');
    await client.query('delete from roles');
    await client.query('delete from companies');

    for (const company of companies) {
      await client.query(
        'insert into companies (id, name, accent_color, webhook_url) values ($1, $2, $3, $4)',
        [company.id, company.name, company.accentColor || '#8b5cf6', company.webhookUrl || '']
      );
    }

    for (const role of roles) {
      await client.query(
        'insert into roles (id, label, tier, color, perms) values ($1, $2, $3, $4, $5::jsonb)',
        [role.id, role.label, role.tier || 1, role.color || '#94a3b8', JSON.stringify(role.perms || [])]
      );
    }

    for (const user of users) {
      await client.query(
        `insert into users
          (id, username, password_hash, coins, role_id, company_id, cart, is_archived, is_pending_activation, must_change_password, account_status, discord_id, discord_username, discord_avatar_url, invite_code_id, server_roles, reprimands)
          values
           ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)`,
        [
          user.id,
          user.username,
          user.password,
          user.coins || 0,
          user.role,
          user.companyId,
          JSON.stringify(user.cart || []),
          !!user.isArchived,
          !!user.isPendingActivation,
          !!user.mustChangePassword,
          user.accountStatus || 'активен',
          user.discordId || '',
          user.discordUsername || '',
          user.discordAvatarUrl || '',
          user.inviteCodeId || null,
          JSON.stringify(user.companyRoles || {}),
          JSON.stringify(user.reprimands || {})
        ]
      );
    }

    for (const user of users) {
      const accessList = Array.isArray(user.authorizedCompanies) && user.authorizedCompanies.length
        ? Array.from(new Set(user.authorizedCompanies))
        : [user.companyId];
      for (const companyId of accessList) {
        await client.query(
          'insert into user_company_access (user_id, company_id) values ($1, $2) on conflict do nothing',
          [user.id, companyId]
        );
      }
    }

    for (const code of codes) {
      await client.query(
        'insert into codes (id, code, company_id, target_username, is_used, created_by, created_at) values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()))',
        [code.id, code.code, code.companyId, code.targetUsername, !!code.isUsed, code.createdBy || null, code.date || null]
      );
    }

    for (const item of items) {
      await client.query(
        'insert into items (id, company_id, name, description, price, item_type, image) values ($1, $2, $3, $4, $5, $6, $7)',
        [item.id, item.companyId, item.name, item.description || '', item.price || 0, item.itemType || 'item', item.image || '']
      );
    }

    for (const log of logs) {
      await client.query(
        'insert into logs (id, user_id, modifier_id, company_id, old_balance, new_balance, type, reason, purchase_details, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, coalesce($10::timestamptz, now()))',
        [log.id, log.userId || null, log.modifierId || null, log.companyId, log.oldBalance || 0, log.newBalance || 0, log.type, log.reason || '', JSON.stringify(log.purchaseDetails || null), log.date || null]
      );
    }

    await client.query('delete from system_config');
    await client.query(
      'insert into system_config (id, webhook_url, avatar_url_template) values (true, $1, $2)',
      [
        snapshot.systemConfig && snapshot.systemConfig.webhookUrl ? snapshot.systemConfig.webhookUrl : '',
        snapshot.systemConfig && snapshot.systemConfig.avatarUrlTemplate ? snapshot.systemConfig.avatarUrlTemplate : DEFAULT_AVATAR_URL_TEMPLATE
      ]
    );

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function sendJson(res, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length
  });
  res.end(body);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, body) => {
    if (err) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': body.length
    });
    res.end(body);
  });
}

function resolveStaticPath(urlPath) {
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const normalized = path.normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(ROOT, normalized);
  if (!fullPath.startsWith(ROOT)) {
    return null;
  }
  return fullPath;
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/public-config') {
    sendJson(res, 200, { ok: true, config: getPublicAppConfig() });
    return true;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      databaseConfigured: !!DATABASE_URL,
      databaseSsl: shouldUseDatabaseSsl(DATABASE_URL)
    });
    return true;
  }

  if (pathname === '/api/db-health') {
    if (!pool) {
      sendJson(res, 500, {
        ok: false,
        error: 'DATABASE_URL is not configured'
      });
      return true;
    }
    try {
      const result = await pool.query('select now() as server_time');
      sendJson(res, 200, {
        ok: true,
        serverTime: result.rows[0].server_time
      });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message
      });
    }
    return true;
  }

  if (pathname === '/api/snapshot' && req.method === 'GET') {
    if (!pool) {
      sendJson(res, 500, { ok: false, error: 'DATABASE_URL is not configured' });
      return true;
    }
    try {
      const snapshot = await fetchSnapshotFromDatabase();
      sendJson(res, 200, { ok: true, snapshot });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/snapshot' && req.method === 'POST') {
    if (!pool) {
      sendJson(res, 500, { ok: false, error: 'DATABASE_URL is not configured' });
      return true;
    }
    try {
      const body = await parseRequestBody(req);
      await saveSnapshotToDatabase(body.snapshot || {});
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/webhook-relay' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const webhookUrl = body.webhookUrl || '';
      const payload = body.payload || null;
      const meta = body.meta || null;

      if (!webhookUrl || !payload) {
        sendJson(res, 400, { ok: false, error: 'webhookUrl and payload are required' });
        return true;
      }

      if (meta && meta.companyId && Array.isArray(meta.itemTypes)) {
        const serverMentionText = await buildServerSideMentionText(meta.companyId, meta.itemTypes);
        payload.content = serverMentionText || undefined;
      }

      const relayResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!relayResponse.ok) {
        const relayText = await relayResponse.text().catch(() => '');
        sendJson(res, relayResponse.status, {
          ok: false,
          error: relayText || `Discord webhook failed with status ${relayResponse.status}`
        });
        return true;
      }

      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    const handled = await handleApi(req, res, pathname);
    if (!handled) {
      sendJson(res, 404, { error: 'Unknown API route' });
    }
    return;
  }

  if (pathname === '/app-config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(`window.__APP_CONFIG__ = ${JSON.stringify(getPublicAppConfig())};`);
    return;
  }

  const fullPath = resolveStaticPath(pathname);
  if (!fullPath || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  sendFile(res, fullPath);
});

async function startServer() {
  try {
    await ensureDatabaseCompat();
    server.listen(PORT, HOST, () => {
      console.log(`Local ModShop server started on ${PUBLIC_APP_URL}`);
      if (DATABASE_URL) {
        console.log(`Database connection is configured${shouldUseDatabaseSsl(DATABASE_URL) ? ' with SSL' : ''}.`);
      } else {
        console.log('Database is not configured yet. Add DATABASE_URL to .env');
      }
    });
  } catch (error) {
    console.error('Failed to start local server:', error);
    process.exit(1);
  }
}

startServer();
