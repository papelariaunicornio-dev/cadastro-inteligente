/**
 * User management — DB layer.
 *
 * user_id strategy: we use `username` as the stable identifier across all
 * tables. This preserves backward compat (existing data has user_id='admin').
 * Usernames are immutable after creation.
 */

import { compare, hash } from 'bcryptjs';
import { list, create, update, remove } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';

const BCRYPT_ROUNDS = 12;

// ==========================================
// Types
// ==========================================

export interface DbUser {
  Id: number;
  username: string;
  password_hash: string;
  name: string | null;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string; // = username (stable identifier)
  username: string;
  name: string | null;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
}

// ==========================================
// Queries
// ==========================================

export async function findUserByUsername(username: string): Promise<DbUser | null> {
  const result = await list<DbUser>(TABLES.USERS, {
    where: `(username,eq,${username})`,
    limit: 1,
  });
  return result.list[0] ?? null;
}

export async function listUsers(): Promise<PublicUser[]> {
  const result = await list<DbUser>(TABLES.USERS, {
    limit: 200,
  });
  return result.list.map(toPublic);
}

function toPublic(u: DbUser): PublicUser {
  return {
    id: u.username, // username = stable user_id
    username: u.username,
    name: u.name,
    role: u.role,
    active: u.active,
    created_at: u.created_at,
  };
}

// ==========================================
// Auth
// ==========================================

/**
 * Verify credentials. Returns PublicUser on success, null on failure.
 * On first ever login, auto-creates admin from env vars (bootstrap).
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<PublicUser | null> {
  let user = await findUserByUsername(username);

  // Bootstrap: if no users exist yet and env vars match → create admin
  if (!user) {
    const envUser = process.env.AUTH_USERNAME;
    const envPass = process.env.AUTH_PASSWORD;

    if (envUser && envPass && username === envUser && password === envPass) {
      user = await createUser(username, password, username, 'admin');
    }

    if (!user) return null;
  }

  if (!user.active) return null;

  const ok = await compare(password, user.password_hash);
  if (!ok) return null;

  return toPublic(user);
}

// ==========================================
// Mutations
// ==========================================

export async function createUser(
  username: string,
  password: string,
  name: string,
  role: 'admin' | 'user' = 'user'
): Promise<DbUser> {
  const existing = await findUserByUsername(username);
  if (existing) throw new Error(`Usuário '${username}' já existe`);

  const password_hash = await hash(password, BCRYPT_ROUNDS);
  const now = new Date().toISOString();

  return create<DbUser>(TABLES.USERS, {
    username,
    password_hash,
    name: name || username,
    role,
    active: true,
    created_at: now,
    updated_at: now,
  });
}

export async function updateUserPassword(
  dbId: number,
  newPassword: string
): Promise<void> {
  const password_hash = await hash(newPassword, BCRYPT_ROUNDS);
  await update(TABLES.USERS, dbId, {
    password_hash,
    updated_at: new Date().toISOString(),
  });
}

export async function updateUserProfile(
  dbId: number,
  data: { name?: string; role?: 'admin' | 'user'; active?: boolean }
): Promise<DbUser> {
  return update<DbUser>(TABLES.USERS, dbId, {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteUser(dbId: number): Promise<void> {
  await remove(TABLES.USERS, dbId);
}
