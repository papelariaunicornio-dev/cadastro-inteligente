/**
 * Migration: Add Nuvemshop + sites_concorrentes columns to user_settings.
 * Safe to run multiple times (skips columns that already exist).
 *
 * Run: npx tsx src/lib/nocodb-migrate.ts
 */

import 'dotenv/config';
import { TABLES } from './nocodb-tables';

const API_URL = process.env.NOCODB_API_URL;
const TOKEN = process.env.NOCODB_API_TOKEN;
const BASE_ID = process.env.NOCODB_BASE_ID;

if (!API_URL || !TOKEN || !BASE_ID) {
  throw new Error('Set NOCODB_API_URL, NOCODB_API_TOKEN, NOCODB_BASE_ID in .env');
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/api/v2${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'xc-token': TOKEN!,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

interface ColumnInfo {
  id: string;
  title: string;
}

interface ListResponse {
  list: ColumnInfo[];
}

async function addColumnIfMissing(
  tableId: string,
  existingNames: Set<string>,
  title: string,
  uidt: string
) {
  if (existingNames.has(title)) {
    console.log(`   ⏭  ${title} already exists`);
    return;
  }

  await apiRequest(`/meta/tables/${tableId}/columns`, {
    method: 'POST',
    body: JSON.stringify({ title, uidt }),
  });

  console.log(`   ✅ Added: ${title}`);
}

async function main() {
  console.log('🔧 Migrating NocoDB user_settings table...\n');

  const tableId = TABLES.USER_SETTINGS;

  // Get existing columns
  const response = await apiRequest<ListResponse>(`/meta/tables/${tableId}/columns`);
  const existing = new Set(response.list.map((c) => c.title));

  console.log(`Found ${existing.size} existing columns in user_settings`);
  console.log('Adding new columns:\n');

  await addColumnIfMissing(tableId, existing, 'nuvemshop_store_id', 'SingleLineText');
  await addColumnIfMissing(tableId, existing, 'nuvemshop_token_encrypted', 'LongText');
  await addColumnIfMissing(tableId, existing, 'sites_concorrentes', 'LongText');

  console.log('\n✅ Migration complete!');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
