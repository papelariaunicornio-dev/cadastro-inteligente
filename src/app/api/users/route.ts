/**
 * GET  /api/users  — List all users (admin only)
 * POST /api/users  — Create a new user (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listUsers, createUser } from '@/lib/auth-db';
import { requireAdmin } from '@/lib/session';

const CreateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Apenas letras, números, ., _ e -'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user']).default('user'),
});

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const users = await listUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const parsed = CreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { username, password, name, role } = parsed.data;
    const user = await createUser(username, password, name, role);

    return NextResponse.json(
      {
        id: user.username,
        username: user.username,
        name: user.name,
        role: user.role,
        active: user.active,
        created_at: user.created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('já existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
  }
}
