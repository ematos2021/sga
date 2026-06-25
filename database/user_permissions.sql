-- ════════════════════════════════════════════════════════════════════════
--  SGA — Permissões de acesso por tela
--  Cada linha concede a um usuário acesso a uma tela específica.
--  Administradores (is_admin = true) ignoram esta tabela e têm acesso
--  total automaticamente.
--
--  Como aplicar:
--   1. Supabase → SQL Editor → New query → cole tudo → Run.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.user_permissions (
    user_id   uuid references public.profiles (id) on delete cascade,
    page_id   text not null,
    primary key (user_id, page_id)
);

-- RLS
alter table public.user_permissions enable row level security;

-- Qualquer autenticado lê suas próprias permissões
drop policy if exists "permissions_read_own" on public.user_permissions;
create policy "permissions_read_own" on public.user_permissions
    for select using (auth.uid() = user_id);

-- Admins leem todas as permissões (para a tela de gerenciamento)
drop policy if exists "permissions_admin_read" on public.user_permissions;
create policy "permissions_admin_read" on public.user_permissions
    for select using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );

-- Admins podem inserir/atualizar/excluir permissões
drop policy if exists "permissions_admin_write" on public.user_permissions;
create policy "permissions_admin_write" on public.user_permissions
    for all using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    )
    with check (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    );
