const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const TABLES = [
  'companies',
  'roles',
  'users',
  'user_company_access',
  'codes',
  'items',
  'logs',
  'system_config'
];

const INSERT_COLUMNS = {
  companies: ['id', 'name', 'accent_color', 'webhook_url', 'created_at'],
  roles: ['id', 'label', 'tier', 'color', 'perms', 'created_at'],
  users: [
    'id',
    'username',
    'password_hash',
    'coins',
    'role_id',
    'company_id',
    'server_roles',
    'reprimands',
    'created_at',
    'cart',
    'is_archived',
    'is_pending_activation',
    'must_change_password',
    'account_status',
    'discord_id',
    'discord_username',
    'discord_avatar_url',
    'invite_code_id'
  ],
  user_company_access: ['user_id', 'company_id', 'created_at'],
  codes: ['id', 'code', 'company_id', 'target_username', 'is_used', 'created_by', 'created_at'],
  items: ['id', 'company_id', 'name', 'description', 'price', 'item_type', 'image', 'created_at'],
  logs: [
    'id',
    'user_id',
    'modifier_id',
    'company_id',
    'old_balance',
    'new_balance',
    'type',
    'reason',
    'purchase_details',
    'created_at'
  ],
  system_config: ['id', 'webhook_url', 'avatar_url_template']
};

function shouldUseSsl(connectionString, explicitValue) {
  const explicit = String(explicitValue || '').toLowerCase();
  if (['1', 'true', 'yes', 'require'].includes(explicit)) return true;
  if (['0', 'false', 'no', 'disable'].includes(explicit)) return false;
  return /supabase\.(co|com)|pooler\.supabase\.com/i.test(connectionString || '');
}

function createPool(connectionString, sslValue) {
  return new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString, sslValue) ? { rejectUnauthorized: false } : undefined
  });
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function fetchRows(pool, table) {
  const result = await pool.query(`select * from ${quoteIdentifier(table)}`);
  return result.rows;
}

async function insertRows(client, table, rows) {
  const columns = INSERT_COLUMNS[table];
  if (!rows.length) return;

  for (const row of rows) {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const columnSql = columns.map(quoteIdentifier).join(', ');
    const values = columns.map((column) => row[column]);
    await client.query(
      `insert into ${quoteIdentifier(table)} (${columnSql}) values (${placeholders})`,
      values
    );
  }
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  const targetUrl = process.env.SUPABASE_DATABASE_URL;

  if (!sourceUrl) {
    throw new Error('Set SOURCE_DATABASE_URL or DATABASE_URL for the source database.');
  }
  if (!targetUrl) {
    throw new Error('Set SUPABASE_DATABASE_URL for the target Supabase database.');
  }
  if (process.env.CONFIRM_MIGRATION !== 'copy-to-supabase') {
    throw new Error('Set CONFIRM_MIGRATION=copy-to-supabase to allow replacing target table data.');
  }

  const source = createPool(sourceUrl, process.env.SOURCE_DATABASE_SSL || process.env.DATABASE_SSL);
  const target = createPool(targetUrl, process.env.SUPABASE_DATABASE_SSL || 'true');
  const targetClient = await target.connect();

  try {
    const data = {};
    for (const table of TABLES) {
      data[table] = await fetchRows(source, table);
      console.log(`Read ${data[table].length} rows from ${table}`);
    }

    await targetClient.query('begin');
    await targetClient.query('delete from user_company_access');
    await targetClient.query('delete from logs');
    await targetClient.query('delete from items');
    await targetClient.query('delete from codes');
    await targetClient.query('delete from users');
    await targetClient.query('delete from roles');
    await targetClient.query('delete from companies');
    await targetClient.query('delete from system_config');

    for (const table of TABLES) {
      await insertRows(targetClient, table, data[table]);
      console.log(`Wrote ${data[table].length} rows to ${table}`);
    }

    await targetClient.query('commit');
    console.log('Migration completed.');
  } catch (error) {
    await targetClient.query('rollback').catch(() => {});
    throw error;
  } finally {
    targetClient.release();
    await source.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
