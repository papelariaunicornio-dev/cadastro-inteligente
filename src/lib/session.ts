/**
 * Session helpers for API routes.
 *
 * user_id = username (stable, immutable).
 * The JWT contains `id` (= username) and `role` set during login.
 */

import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface SessionUser {
  id: string; // username — the user_id used across all DB tables
  role: 'admin' | 'user';
}

/**
 * Get the current user from the JWT, or null if unauthenticated.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return null;
  return {
    id: token.id as string,
    role: (token.role as 'admin' | 'user') ?? 'user',
  };
}

/**
 * Get the current user or return a 401 response.
 * Pattern: `const { user, response } = await requireAuth(request); if (response) return response;`
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ user: SessionUser; response: null } | { user: null; response: NextResponse }> {
  const user = await getSessionUser(req);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    };
  }
  return { user, response: null };
}

/**
 * Require admin role or return a 403 response.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ user: SessionUser; response: null } | { user: null; response: NextResponse }> {
  const authResult = await requireAuth(req);
  if (authResult.response) return authResult;

  const { user } = authResult;
  if (user.role !== 'admin') {
    return {
      user: null,
      response: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }),
    };
  }
  return { user, response: null };
}
