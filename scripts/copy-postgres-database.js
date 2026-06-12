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

const DELETE_ORDER = [
  'user_company_access',
  'logs',
  'items',
  'codes',
  'users',
  'roles',
  'companies',
  'system_config'
];

function shouldUseSsl(connectionString, explicitValue) {
  const explicit = String(explicitValue || '').toLowerCase();
  if (['1', 'true', 'yes', 'require'].includes(explicit)) return true;
  if (['0', 'false', 'no', 'disable'].includes(explicit)) return false;
  return /supabase\.(co|com)|pooler\.supabase\.com/i.test(connectionString || '');
}

function createPool(connectionString, sslValue) {
  return new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    ssl: shouldUseSsl(connectionString, sslValue) ? { rejectUnauthorized: false } : undefined
  });
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function getColumns(pool, table) {
  const result = await pool.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

async function copyRows(source, targetClient, table) {
  const sourceColumns = await getColumns(source, table);
  const targetColumnsResult = await targetClient.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table]
  );
  const targetColumns = new Set(targetColumnsResult.rows.map((row) => row.column_name));
  const columns = sourceColumns.filter((column) => targetColumns.has(column));
  if (!columns.length) throw new Error(`No compatible columns found for ${table}.`);

  const rowsResult = await source.query(`select * from ${quoteIdentifier(table)}`);
  for (const row of rowsResult.rows) {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await targetClient.query(
      `insert into ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) values (${placeholders})`,
      columns.map((column) => row[column])
    );
  }
  return rowsResult.rows.length;
}

async function countRows(pool, table) {
  const result = await pool.query(`select count(*)::integer as count from ${quoteIdentifier(table)}`);
  return result.rows[0].count;
}

async function main() {
  const sourceUrl = process.env.MIGRATION_SOURCE_DATABASE_URL || process.env.DATABASE_URL;
  const targetUrl = process.env.MIGRATION_TARGET_DATABASE_URL || (
    process.env.POSTGRES_PASSWORD
      ? `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || 'modshop')}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@postgres:5432/${encodeURIComponent(process.env.POSTGRES_DB || 'modshop')}`
      : ''
  );
  if (!sourceUrl) throw new Error('Set MIGRATION_SOURCE_DATABASE_URL or DATABASE_URL.');
  if (!targetUrl) throw new Error('Set MIGRATION_TARGET_DATABASE_URL or POSTGRES_PASSWORD.');
  if (sourceUrl === targetUrl) throw new Error('Source and target database URLs must be different.');
  if (process.env.CONFIRM_POSTGRES_COPY !== 'copy-postgres-data') {
    throw new Error('Set CONFIRM_POSTGRES_COPY=copy-postgres-data to replace target data.');
  }

  const source = createPool(sourceUrl, process.env.MIGRATION_SOURCE_DATABASE_SSL || process.env.DATABASE_SSL);
  const target = createPool(targetUrl, process.env.MIGRATION_TARGET_DATABASE_SSL || 'false');
  const targetClient = await target.connect();
  try {
    await source.query('select 1');
    await targetClient.query('select 1');
    await targetClient.query('begin');
    for (const table of DELETE_ORDER) {
      await targetClient.query(`delete from ${quoteIdentifier(table)}`);
    }
    const copiedCounts = {};
    for (const table of TABLES) {
      copiedCounts[table] = await copyRows(source, targetClient, table);
      console.log(`Copied ${copiedCounts[table]} rows: ${table}`);
    }
    for (const table of TABLES) {
      const targetCount = await countRows(targetClient, table);
      if (targetCount !== copiedCounts[table]) {
        throw new Error(`Verification failed for ${table}: expected ${copiedCounts[table]}, got ${targetCount}.`);
      }
    }
    await targetClient.query('commit');
    console.log('Migration completed and row counts verified.');
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
