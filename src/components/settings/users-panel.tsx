'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  UserPlus,
  Loader2,
  Trash2,
  KeyRound,
  ShieldCheck,
  User,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ==========================================
// Types
// ==========================================

interface UserRecord {
  id: string;
  username: string;
  name: string | null;
  role: 'admin' | 'user';
  active: boolean;
  created_at: string;
}

// ==========================================
// Create user dialog
// ==========================================

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateUserDialog({ open, onClose, onCreated }: CreateDialogProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function reset() {
    setUsername(''); setName(''); setPassword(''); setRole('user'); setShowPass(false);
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar usuário');
        return;
      }
      toast.success(`Usuário '${username}' criado`);
      reset();
      onCreated();
      onClose();
    } catch {
      toast.error('Erro de rede');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Cada usuário tem suas próprias configurações, produtos e integrações.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                placeholder="joao.silva"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[10px] text-muted-foreground">Letras, números, . _ -</p>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="João Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !username || !password || password.length < 8}
          >
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Change password dialog
// ==========================================

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
  user: UserRecord | null;
  isSelf: boolean;
}

function ChangePasswordDialog({ open, onClose, user, isSelf }: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNext, setShowNext] = useState(false);

  function reset() { setCurrent(''); setNext(''); setConfirm(''); }

  async function handleSave() {
    if (next !== confirm) { toast.error('As senhas não coincidem'); return; }
    if (next.length < 8) { toast.error('Mínimo 8 caracteres'); return; }
    setSaving(true);
    try {
      const body: Record<string, string> = { password: next };
      if (isSelf) body.currentPassword = current;

      const res = await fetch(`/api/users/${user?.username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { toast.error(data.error || 'Erro'); return; }
      toast.success('Senha alterada');
      reset();
      onClose();
    } catch {
      toast.error('Erro de rede');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar senha — {user?.name || user?.username}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {isSelf && (
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={showNext ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <button type="button" onClick={() => setShowNext(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !next || next.length < 8 || next !== confirm}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// User row
// ==========================================

interface UserRowProps {
  user: UserRecord;
  currentUserId: string;
  isAdmin: boolean;
  onToggleActive: (u: UserRecord) => void;
  onChangePassword: (u: UserRecord) => void;
  onDelete: (u: UserRecord) => void;
  onRoleChange: (u: UserRecord, role: 'admin' | 'user') => void;
}

function UserRow({
  user, currentUserId, isAdmin,
  onToggleActive, onChangePassword, onDelete, onRoleChange,
}: UserRowProps) {
  const isSelf = user.id === currentUserId;

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${!user.active ? 'opacity-60' : ''}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
        {(user.name || user.username).charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{user.name || user.username}</p>
          {isSelf && <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">Você</Badge>}
          {!user.active && <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] text-muted-foreground">Inativo</Badge>}
        </div>
        <p className="text-[11px] text-muted-foreground">@{user.username}</p>
      </div>

      {/* Role selector (admin only, can't change self) */}
      {isAdmin && !isSelf ? (
        <Select
          value={user.role}
          onValueChange={(v) => onRoleChange(user, v as 'admin' | 'user')}
        >
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">
              <span className="flex items-center gap-1.5"><User className="h-3 w-3" />Usuário</span>
            </SelectItem>
            <SelectItem value="admin">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" />Admin</span>
            </SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
          {user.role === 'admin'
            ? <><ShieldCheck className="h-3 w-3" />Admin</>
            : <><User className="h-3 w-3" />Usuário</>
          }
        </Badge>
      )}

      {/* Active toggle (admin only, not self) */}
      {isAdmin && !isSelf && (
        <Switch
          checked={user.active}
          onCheckedChange={() => onToggleActive(user)}
          className="shrink-0"
        />
      )}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChangePassword(user)}
          title="Alterar senha"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
        {isAdmin && !isSelf && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => onDelete(user)}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Main panel
// ==========================================

export function UsersPanel() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? '';
  const isAdmin = session?.user?.role === 'admin';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [changePwUser, setChangePwUser] = useState<UserRecord | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Erro ao carregar usuários'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
    else setLoading(false);
  }, [isAdmin, fetchUsers]);

  async function patchUser(username: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${username}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Erro');
    fetchUsers();
  }

  async function handleToggleActive(user: UserRecord) {
    try {
      await patchUser(user.username, { active: !user.active });
      toast.success(user.active ? `${user.name} desativado` : `${user.name} ativado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function handleRoleChange(user: UserRecord, role: 'admin' | 'user') {
    try {
      await patchUser(user.username, { role });
      toast.success(`Perfil de ${user.name} atualizado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    }
  }

  async function handleDelete(user: UserRecord) {
    if (!confirm(`Excluir '${user.username}'? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch(`/api/users/${user.username}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { toast.error(data.error || 'Erro'); return; }
      toast.success(`Usuário '${user.username}' excluído`);
      fetchUsers();
    } catch {
      toast.error('Erro de rede');
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        Apenas administradores podem gerenciar usuários.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} {users.length === 1 ? 'usuário' : 'usuários'}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Novo usuário
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum usuário encontrado
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onToggleActive={handleToggleActive}
              onChangePassword={(usr) => setChangePwUser(usr)}
              onDelete={handleDelete}
              onRoleChange={handleRoleChange}
            />
          ))}
        </div>
      )}

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchUsers}
      />

      <ChangePasswordDialog
        open={!!changePwUser}
        onClose={() => setChangePwUser(null)}
        user={changePwUser}
        isSelf={changePwUser?.id === currentUserId}
      />
    </div>
  );
}
