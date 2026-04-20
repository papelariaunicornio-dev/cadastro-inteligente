/**
 * GET  /api/users/me  — Current user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/auth-db';
import { requireAuth } from '@/lib/session';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const user = await findUserByUsername(auth.user.id);
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.username,
      username: user.username,
      name: user.name,
      role: user.role,
      active: user.active,
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}
