const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '.env') });

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4174);
const DATABASE_URL = process.env.DATABASE_URL || '';
const DATABASE_SSL = String(process.env.DATABASE_SSL || '').toLowerCase();
const DATABASE_SSL_REJECT_UNAUTHORIZED = String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
const DATABASE_CONNECTION_TIMEOUT_MS = Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS || 10000);
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || `http://localhost:${PORT}`;
const DISCORD_OAUTH_CLIENT_ID = process.env.DISCORD_OAUTH_CLIENT_ID || '1492710758658871336';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const ROOT = __dirname;
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const MAX_STORE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_STORE_IMAGE_REQUEST_BYTES = 7 * 1024 * 1024;
const UNUSED_STORE_IMAGE_GRACE_MS = 60 * 60 * 1000;
const MAX_STORE_ITEM_PRICE = 100000;
const DEFAULT_AVATAR_URL_TEMPLATE = 'https://skins.mcskill.net/?name=insert&mode=5&fx=size&fy=size';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
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
      connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
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

function mapUserRow(row, accessRows, allCompanyIds = []) {
  const companyAccess = accessRows
    .filter((entry) => entry.user_id === row.id)
    .map((entry) => entry.company_id);
  const isWebsiteAdmin = row.role_id === 'admin'
    || (row.server_roles && Object.values(row.server_roles).includes('admin'));
  const accessList = isWebsiteAdmin
    ? Array.from(new Set(allCompanyIds.concat(row.company_id).filter(Boolean)))
    : (companyAccess.length ? companyAccess : [row.company_id]);
  const companyRoles = row.server_roles && typeof row.server_roles === 'object'
    ? { ...row.server_roles }
    : {};
  const reprimands = row.reprimands && typeof row.reprimands === 'object'
    ? { ...row.reprimands }
    : {};
  accessList.forEach((companyId) => {
    if (isWebsiteAdmin) {
      companyRoles[companyId] = 'admin';
      return;
    }
    if (!companyRoles[companyId]) {
      companyRoles[companyId] = row.role_id;
    }
    if (companyRoles[companyId] === 'waiting') {
      companyRoles[companyId] = 'helper';
    }
  });
  const roleId = isWebsiteAdmin ? 'admin' : (row.role_id === 'waiting' ? 'helper' : row.role_id);

  return {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    coins: row.coins || 0,
    role: roleId,
    companyId: row.company_id,
    date: row.created_at,
    lastLoginAt: row.last_login_at || null,
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
    price: Math.max(0, Math.min(MAX_STORE_ITEM_PRICE, Number(row.price) || 0)),
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
    avatarUrlTemplate: row && row.avatar_url_template ? row.avatar_url_template : DEFAULT_AVATAR_URL_TEMPLATE,
    bonusRequests: row && Array.isArray(row.bonus_requests) ? row.bonus_requests : [],
    bonusPermissionsInitialized: !!(row && row.bonus_permissions_initialized)
  };
}

function buildSnapshot(rows) {
  const allCompanyIds = rows.companies.map((company) => company.id);
  return {
    users: rows.users.map((row) => mapUserRow(row, rows.access, allCompanyIds)),
    codes: rows.codes.map(mapCodeRow),
    items: rows.items.map(mapItemRow),
    logs: rows.logs.map(mapLogRow),
    roles: rows.roles.map(mapRoleRow),
    companies: rows.companies.map(mapCompanyRow),
    systemConfig: mapSystemConfigRow(rows.systemConfig[0] || null),
    _lastSavedAt: new Date().toISOString()
  };
}

function parseRequestBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let exceededLimit = false;
    req.on('data', (chunk) => {
      if (exceededLimit) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        exceededLimit = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (exceededLimit) {
        reject(new Error('Размер запроса превышает допустимый лимит.'));
        return;
      }
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

function getStoreImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  return null;
}

function saveStoreImage(dataUrl) {
  const match = String(dataUrl || '').match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('Поддерживаются только JPG, PNG и WebP.');
  const buffer = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('Файл изображения пуст.');
  if (buffer.length > MAX_STORE_IMAGE_BYTES) throw new Error('Изображение должно быть не больше 5 МБ.');
  const imageType = getStoreImageType(buffer);
  if (!imageType) throw new Error('Формат изображения не распознан.');
  const fileName = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}.${imageType.extension}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer, { flag: 'wx' });
  return { url: `/uploads/${fileName}`, mimeType: imageType.mimeType, size: buffer.length };
}

function getLocalStoreImageFileName(imageUrl) {
  const value = String(imageUrl || '').trim();
  const match = value.match(/^\/uploads\/([a-z0-9-]+\.(?:png|jpe?g|webp))$/i);
  return match ? match[1] : '';
}

async function deleteUnusedStoreImage(imageUrl) {
  const fileName = getLocalStoreImageFileName(imageUrl);
  if (!fileName || !pool) return false;
  const usedResult = await pool.query('select 1 from items where image = $1 limit 1', [`/uploads/${fileName}`]);
  if (usedResult.rowCount) return false;
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

async function cleanupUnusedStoreImages(minAgeMs = UNUSED_STORE_IMAGE_GRACE_MS) {
  if (!pool) return 0;
  const usedResult = await pool.query("select image from items where image like '/uploads/%'");
  const usedFiles = new Set(usedResult.rows.map((row) => getLocalStoreImageFileName(row.image)).filter(Boolean));
  const cutoff = Date.now() - minAgeMs;
  let deleted = 0;
  for (const entry of fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || usedFiles.has(entry.name)) continue;
    if (!getLocalStoreImageFileName(`/uploads/${entry.name}`)) continue;
    const filePath = path.join(UPLOADS_DIR, entry.name);
    if (fs.statSync(filePath).mtimeMs > cutoff) continue;
    fs.unlinkSync(filePath);
    deleted += 1;
  }
  return deleted;
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
    alter table if exists users
    add column if not exists last_login_at timestamptz null
  `);
  await pool.query(`
    alter table if exists logs
    add column if not exists purchase_details jsonb null
  `);
  await pool.query(`
    alter table if exists system_config
    add column if not exists avatar_url_template text not null default '${DEFAULT_AVATAR_URL_TEMPLATE}'
  `);
  await pool.query(`
    alter table if exists system_config
    add column if not exists bonus_requests jsonb not null default '[]'::jsonb
  `);
  await pool.query(`
    alter table if exists system_config
    add column if not exists bonus_permissions_initialized boolean not null default false
  `);
  await pool.query(`update items set price = greatest(0, least(price, ${MAX_STORE_ITEM_PRICE})) where price < 0 or price > ${MAX_STORE_ITEM_PRICE}`);
  await pool.query(`
    do $$
    begin
      if not exists (
        select 1 from pg_constraint where conname = 'items_price_range'
      ) then
        alter table items add constraint items_price_range check (price between 0 and ${MAX_STORE_ITEM_PRICE});
      end if;
    end $$
  `);
}

async function saveSnapshotToDatabase(snapshot, actorUserId) {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('begin');
    transactionStarted = true;
    await client.query("select pg_advisory_xact_lock(hashtext('modshop_full_snapshot_save'))");

    const existingUsersResult = await client.query('select id, username, role_id, server_roles, last_login_at from users');
    const existingCompaniesResult = await client.query('select id from companies');
    const existingUsers = new Map(existingUsersResult.rows.map((row) => [row.id, row]));
    const existingCompanyIds = new Set(existingCompaniesResult.rows.map((row) => row.id));
    const companies = uniqueBy(snapshot.companies || [], (item) => item.id);
    const roles = uniqueBy(snapshot.roles || [], (item) => item.id);
    const users = uniqueBy(snapshot.users || [], (item) => item.id || item.username);
    const codes = uniqueBy(snapshot.codes || [], (item) => item.id || item.code);
    const items = uniqueBy(snapshot.items || [], (item) => item.id);
    const logs = uniqueBy(snapshot.logs || [], (item) => item.id);
    const userIds = new Set(users.map((user) => user.id).filter(Boolean));
    const companyIds = new Set(companies.map((company) => company.id).filter(Boolean));
    const actorFromExisting = actorUserId ? existingUsers.get(actorUserId) : null;
    const actorFromSnapshot = actorUserId ? users.find((user) => user.id === actorUserId) : null;
    const isPrimaryOwnerActor =
      (actorFromExisting && actorFromExisting.username === 'sereshkkka') ||
      (actorFromSnapshot && actorFromSnapshot.username === 'sereshkkka');

    const looksLikeBootstrapSnapshot =
      users.length <= 1 &&
      users.some((user) => user.username === 'sereshkkka') &&
      companies.length <= 1;
    if (
      looksLikeBootstrapSnapshot &&
      (existingUsers.size > users.length || existingCompanyIds.size > companies.length)
    ) {
      throw new Error('Refusing to overwrite Supabase with an incomplete startup snapshot.');
    }

    for (const user of users) {
      if (user.username === 'sereshkkka') continue;
      const existingUser = existingUsers.get(user.id);
      if (!existingUser) continue;

      const existingServerRoles = existingUser.server_roles && typeof existingUser.server_roles === 'object'
        ? existingUser.server_roles
        : {};
      const nextServerRoles = user.companyRoles && typeof user.companyRoles === 'object'
        ? user.companyRoles
        : {};
      const existingHasAdmin = existingUser.role_id === 'admin' || Object.values(existingServerRoles).includes('admin');
      const nextHasAdmin = user.role === 'admin' || Object.values(nextServerRoles).includes('admin');

      if (existingHasAdmin !== nextHasAdmin && !isPrimaryOwnerActor) {
        user.role = existingUser.role_id;
        user.companyRoles = { ...existingServerRoles };
      }
    }

    for (const user of users) {
      const isWebsiteAdmin = user.role === 'admin'
        || (user.companyRoles && Object.values(user.companyRoles).includes('admin'));
      if (isWebsiteAdmin) {
        user.role = 'admin';
        user.authorizedCompanies = Array.from(companyIds);
        user.companyRoles = Object.fromEntries(Array.from(companyIds).map((companyId) => [companyId, 'admin']));
      }
    }

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
          (id, username, password_hash, coins, role_id, company_id, cart, is_archived, is_pending_activation, must_change_password, account_status, discord_id, discord_username, discord_avatar_url, invite_code_id, server_roles, reprimands, last_login_at)
          values
           ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::timestamptz)`,
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
          JSON.stringify(user.reprimands || {}),
          user.lastLoginAt || (existingUsers.get(user.id) && existingUsers.get(user.id).last_login_at) || null
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
      const createdBy = code.createdBy && userIds.has(code.createdBy)
        ? code.createdBy
        : null;
      await client.query(
        'insert into codes (id, code, company_id, target_username, is_used, created_by, created_at) values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()))',
        [code.id, code.code, code.companyId, code.targetUsername, !!code.isUsed, createdBy, code.date || null]
      );
    }

    for (const item of items) {
      await client.query(
        'insert into items (id, company_id, name, description, price, item_type, image) values ($1, $2, $3, $4, $5, $6, $7)',
        [item.id, item.companyId, item.name, item.description || '', Math.max(0, Math.min(MAX_STORE_ITEM_PRICE, Number(item.price) || 0)), item.itemType || 'item', item.image || '']
      );
    }

    for (const log of logs) {
      const logUserId = log.userId || null;
      const logModifierId = log.modifierId || null;
      if ((logUserId && !userIds.has(logUserId)) || (logModifierId && !userIds.has(logModifierId))) {
        continue;
      }
      if (log.companyId && !companyIds.has(log.companyId)) {
        continue;
      }
      await client.query(
        'insert into logs (id, user_id, modifier_id, company_id, old_balance, new_balance, type, reason, purchase_details, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, coalesce($10::timestamptz, now()))',
        [log.id, logUserId, logModifierId, log.companyId, log.oldBalance || 0, log.newBalance || 0, log.type, log.reason || '', JSON.stringify(log.purchaseDetails || null), log.date || null]
      );
    }

    await client.query('delete from system_config');
    await client.query(
      'insert into system_config (id, webhook_url, avatar_url_template, bonus_requests, bonus_permissions_initialized) values (true, $1, $2, $3::jsonb, $4)',
      [
        snapshot.systemConfig && snapshot.systemConfig.webhookUrl ? snapshot.systemConfig.webhookUrl : '',
        snapshot.systemConfig && snapshot.systemConfig.avatarUrlTemplate ? snapshot.systemConfig.avatarUrlTemplate : DEFAULT_AVATAR_URL_TEMPLATE,
        JSON.stringify(snapshot.systemConfig && Array.isArray(snapshot.systemConfig.bonusRequests) ? snapshot.systemConfig.bonusRequests : []),
        !!(snapshot.systemConfig && snapshot.systemConfig.bonusPermissionsInitialized)
      ]
    );

    await client.query('commit');
    transactionStarted = false;
    cleanupUnusedStoreImages().catch((error) => console.error('Store image cleanup failed:', error));
  } catch (error) {
    if (transactionStarted) {
      await client.query('rollback');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function activateInviteCode(inviteCode, passwordHash) {
  const normalizedCode = String(inviteCode || '').trim().toUpperCase();
  const normalizedPasswordHash = String(passwordHash || '').trim().toLowerCase();
  if (!normalizedCode || !/^[a-f0-9]{64}$/.test(normalizedPasswordHash)) {
    throw new Error('Некорректный код приглашения или пароль.');
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const codeResult = await client.query(
      `select * from codes where upper(code) = $1 for update`,
      [normalizedCode]
    );
    const codeRow = codeResult.rows[0];
    if (!codeRow || codeRow.is_used) {
      throw new Error('Неверный или уже использованный код приглашения.');
    }

    const userResult = await client.query(
      `select * from users
       where invite_code_id = $1
         and company_id = $2
         and lower(username) = lower($3)
       for update`,
      [codeRow.id, codeRow.company_id, codeRow.target_username]
    );
    const userRow = userResult.rows[0];
    if (!userRow) {
      throw new Error('Для этого кода не найден аккаунт, ожидающий активации.');
    }

    const updatedUserResult = await client.query(
      `update users
       set password_hash = $1,
           is_pending_activation = false,
           must_change_password = false,
           account_status = $2,
           invite_code_id = null,
           last_login_at = now()
       where id = $3
       returning *`,
      [normalizedPasswordHash, 'активен', userRow.id]
    );
    const updatedCodeResult = await client.query(
      `update codes set is_used = true where id = $1 returning *`,
      [codeRow.id]
    );
    const accessResult = await client.query(
      `select user_id, company_id from user_company_access where user_id = $1`,
      [userRow.id]
    );
    await client.query('commit');

    return {
      username: updatedUserResult.rows[0].username,
      user: mapUserRow(updatedUserResult.rows[0], accessResult.rows),
      code: mapCodeRow(updatedCodeResult.rows[0])
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function recordUserLogin(userId, passwordHash, discordId) {
  const normalizedUserId = String(userId || '').trim();
  const normalizedPasswordHash = String(passwordHash || '').trim().toLowerCase();
  const normalizedDiscordId = normalizeDiscordId(discordId);
  if (!normalizedUserId) {
    throw new Error('User id is required.');
  }

  const userResult = await pool.query('select * from users where id = $1', [normalizedUserId]);
  const user = userResult.rows[0];
  if (!user) {
    throw new Error('User not found.');
  }
  const passwordMatches = normalizedPasswordHash && String(user.password_hash || '') === normalizedPasswordHash;
  const discordMatches = normalizedDiscordId && normalizeDiscordId(user.discord_id) === normalizedDiscordId;
  if (!passwordMatches && !discordMatches) {
    throw new Error('Login proof is invalid.');
  }

  const updatedResult = await pool.query(
    'update users set last_login_at = now() where id = $1 returning last_login_at',
    [normalizedUserId]
  );
  return updatedResult.rows[0].last_login_at;
}

async function updateUserRole(actorUserId, actorPasswordHash, targetUserId, companyId, newRoleId) {
  if (!actorUserId || !actorPasswordHash || !targetUserId || !companyId || !newRoleId) {
    throw new Error('Не указаны данные для изменения роли.');
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const usersResult = await client.query(
      `select * from users where id = any($1::text[]) for update`,
      [[actorUserId, targetUserId]]
    );
    const actor = usersResult.rows.find((row) => row.id === actorUserId);
    const target = usersResult.rows.find((row) => row.id === targetUserId);
    if (!actor || !target) throw new Error('Пользователь не найден.');
    if (String(actor.password_hash || '') !== String(actorPasswordHash || '')) {
      throw new Error('Сессия пользователя не подтверждена.');
    }

    const rolesResult = await client.query(
      `select id, tier, perms from roles where id = any($1::text[])`,
      [Array.from(new Set([actor.role_id, target.role_id, newRoleId]))]
    );
    const roleMap = new Map(rolesResult.rows.map((role) => [role.id, role]));
    const newRole = roleMap.get(newRoleId);
    if (!newRole) throw new Error('Выбранная роль не найдена.');

    const actorServerRoles = actor.server_roles && typeof actor.server_roles === 'object' ? actor.server_roles : {};
    const targetServerRoles = target.server_roles && typeof target.server_roles === 'object' ? target.server_roles : {};
    const actorRoleId = actorServerRoles[companyId] || actor.role_id;
    const targetRoleId = targetServerRoles[companyId] || target.role_id;
    const actorRole = roleMap.get(actorRoleId) || (await client.query('select id, tier, perms from roles where id = $1', [actorRoleId])).rows[0];
    const targetRole = roleMap.get(targetRoleId) || (await client.query('select id, tier, perms from roles where id = $1', [targetRoleId])).rows[0];
    const actorPerms = actorRole && Array.isArray(actorRole.perms) ? actorRole.perms : [];
    const isPrimaryOwner = String(actor.username || '').toLowerCase() === 'sereshkkka';
    const canEditRoles = isPrimaryOwner || actorRoleId === 'admin' || actorPerms.includes('all') || actorPerms.includes('edit_roles');
    if (!canEditRoles) throw new Error('Недостаточно прав для изменения роли.');
    if ((targetRoleId === 'admin' || newRoleId === 'admin') && !isPrimaryOwner) {
      throw new Error('Только sereshkkka может выдавать или забирать роль администратора сайта.');
    }
    if (!isPrimaryOwner && (Number(newRole.tier) >= Number(actorRole.tier) || Number(targetRole && targetRole.tier) >= Number(actorRole.tier))) {
      throw new Error('Нельзя назначить роль своего уровня или выше.');
    }

    let nextRoleId = target.role_id;
    let nextServerRoles = { ...targetServerRoles };
    if (newRoleId === 'admin') {
      const companiesResult = await client.query('select id from companies');
      nextRoleId = 'admin';
      nextServerRoles = Object.fromEntries(companiesResult.rows.map((company) => [company.id, 'admin']));
      await client.query(
        `insert into user_company_access (user_id, company_id)
         select $1, id from companies
         on conflict do nothing`,
        [targetUserId]
      );
    } else if (target.role_id === 'admin' || Object.values(targetServerRoles).includes('admin')) {
      nextRoleId = newRoleId;
      nextServerRoles = Object.fromEntries(
        Object.keys(targetServerRoles).map((serverCompanyId) => [
          serverCompanyId,
          serverCompanyId === companyId ? newRoleId : 'helper'
        ])
      );
      nextServerRoles[companyId] = newRoleId;
      await client.query('delete from user_company_access where user_id = $1', [targetUserId]);
      await client.query(
        `insert into user_company_access (user_id, company_id)
         select $1, company_id
         from (values ($2::text), ($3::text)) as access(company_id)
         on conflict do nothing`,
        [targetUserId, target.company_id, companyId]
      );
    } else {
      nextServerRoles[companyId] = newRoleId;
      if (target.company_id === companyId) nextRoleId = newRoleId;
    }

    const updatedResult = await client.query(
      `update users set server_roles = $1::jsonb, role_id = $2 where id = $3 returning *`,
      [JSON.stringify(nextServerRoles), nextRoleId, targetUserId]
    );
    const accessResult = await client.query(
      `select user_id, company_id from user_company_access where user_id = $1`,
      [targetUserId]
    );
    const companiesResult = await client.query('select id from companies');
    await client.query('commit');
    return mapUserRow(updatedResult.rows[0], accessResult.rows, companiesResult.rows.map((company) => company.id));
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
    const fileName = path.basename(filePath).toLowerCase();
    const cacheControl = ext === '.html' || ext === '.js' || fileName === 'app-config.js'
      ? 'no-store, no-cache, must-revalidate, proxy-revalidate'
      : 'public, max-age=3600';
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': cacheControl
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
      await saveSnapshotToDatabase(body.snapshot || {}, body.actorUserId || null);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/activate-invite' && req.method === 'POST') {
    if (!pool) {
      sendJson(res, 500, { ok: false, error: 'DATABASE_URL is not configured' });
      return true;
    }
    try {
      const body = await parseRequestBody(req);
      const result = await activateInviteCode(body.inviteCode, body.passwordHash);
      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/record-login' && req.method === 'POST') {
    if (!pool) {
      sendJson(res, 500, { ok: false, error: 'DATABASE_URL is not configured' });
      return true;
    }
    try {
      const body = await parseRequestBody(req);
      const lastLoginAt = await recordUserLogin(body.userId, body.passwordHash, body.discordId);
      sendJson(res, 200, { ok: true, lastLoginAt });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/store-images' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req, MAX_STORE_IMAGE_REQUEST_BYTES);
      const image = saveStoreImage(body.dataUrl);
      sendJson(res, 201, { ok: true, image });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/store-images' && req.method === 'DELETE') {
    try {
      const body = await parseRequestBody(req);
      const deleted = await deleteUnusedStoreImage(body.url);
      sendJson(res, 200, { ok: true, deleted });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  if (pathname === '/api/update-user-role' && req.method === 'POST') {
    if (!pool) {
      sendJson(res, 500, { ok: false, error: 'DATABASE_URL is not configured' });
      return true;
    }
    try {
      const body = await parseRequestBody(req);
      const user = await updateUserRole(body.actorUserId, body.actorPasswordHash, body.targetUserId, body.companyId, body.newRoleId);
      sendJson(res, 200, { ok: true, user });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
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

  if (pathname.startsWith('/uploads/')) {
    const fileName = path.basename(pathname);
    const uploadPath = path.join(UPLOADS_DIR, fileName);
    if (!fileName || !fs.existsSync(uploadPath) || fs.statSync(uploadPath).isDirectory()) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    sendFile(res, uploadPath);
    return;
  }

  const fullPath = resolveStaticPath(pathname);
  if (!fullPath || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  sendFile(res, fullPath);
});

function startServer() {
  server.on('error', (error) => {
    console.error('Failed to start HTTP server:', error);
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log(`ModShop server started on ${HOST}:${PORT} (${PUBLIC_APP_URL})`);
    if (!DATABASE_URL) {
      console.log('Database is not configured yet. Add DATABASE_URL to the environment.');
      return;
    }

    console.log(`Database connection is configured${shouldUseDatabaseSsl(DATABASE_URL) ? ' with SSL' : ''}.`);
    ensureDatabaseCompat()
      .then(async () => {
        console.log('Database compatibility check completed.');
        const deleted = await cleanupUnusedStoreImages();
        if (deleted) console.log(`Removed ${deleted} unused store image(s).`);
      })
      .catch((error) => console.error('Database compatibility check failed:', error));
  });
}

startServer();
