/**
 * PATCH  /api/users/[id]  — Update user (admin, or self for name/password)
 * DELETE /api/users/[id]  — Delete user (admin only)
 *
 * [id] = username
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { findUserByUsername, updateUserPassword, updateUserProfile, deleteUser } from '@/lib/auth-db';
import { requireAuth } from '@/lib/session';

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  currentPassword: z.string().optional(), // Required when changing own password
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { id: targetUsername } = await params;
  const isSelf = auth.user.id === targetUsername;
  const isAdmin = auth.user.role === 'admin';

  // Only admin or self can update
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, role, active, password, currentPassword } = parsed.data;

    // Non-admins can only update their own name and password
    if (!isAdmin && (role !== undefined || active !== undefined)) {
      return NextResponse.json({ error: 'Sem permissão para alterar role/status' }, { status: 403 });
    }

    const targetUser = await findUserByUsername(targetUsername);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Password change
    if (password) {
      if (isSelf && !isAdmin) {
        // Self must provide current password
        if (!currentPassword) {
          return NextResponse.json(
            { error: 'Senha atual obrigatória' },
            { status: 400 }
          );
        }
        const { compare } = await import('bcryptjs');
        const ok = await compare(currentPassword, targetUser.password_hash);
        if (!ok) {
          return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
        }
      }
      await updateUserPassword(targetUser.Id, password);
    }

    // Profile update
    if (name !== undefined || role !== undefined || active !== undefined) {
      await updateUserProfile(targetUser.Id, {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined && isAdmin ? { role } : {}),
        ...(active !== undefined && isAdmin ? { active } : {}),
      });
    }

    const updated = await findUserByUsername(targetUsername);
    return NextResponse.json({
      id: updated!.username,
      username: updated!.username,
      name: updated!.name,
      role: updated!.role,
      active: updated!.active,
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const { id: targetUsername } = await params;

  if (auth.user.id === targetUsername) {
    return NextResponse.json({ error: 'Não é possível excluir sua própria conta' }, { status: 400 });
  }

  try {
    const targetUser = await findUserByUsername(targetUsername);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    await deleteUser(targetUser.Id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 });
  }
}
