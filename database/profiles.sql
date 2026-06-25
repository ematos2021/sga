-- ════════════════════════════════════════════════════════════════════════
--  SGA — Usuários (perfis) ligados ao Supabase Auth
--  Login = Supabase Auth (auth.users). Esta tabela guarda nome, papel,
--  avatar, is_admin e ativo. Um trigger cria o perfil automaticamente
--  quando um usuário é criado no Auth.
--
--  Como aplicar:
--   1. Supabase → SQL Editor → New query → cole tudo → Run.
--   2. Authentication → Providers → Email: habilite. Desative "Confirm email"
--      (para usuários criados pelo admin já conseguirem logar na hora).
--   3. Crie o 1º usuário (Authentication → Add user, ou faça login uma vez)
--      e marque como admin:   update public.profiles set is_admin = true
--                              where email = 'seu-email@empresa.com';
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    email       text,
    name        text,
    role        text default 'analista',   -- gestor | analista | operador
    avatar      text default '👤',
    is_admin    boolean default false,
    active      boolean default true,
    created_at  timestamptz default now()
);

-- Cria o perfil automaticamente ao registrar um usuário no Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email))
    on conflict (id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;

-- Qualquer usuário autenticado lê os perfis (para a tela e o login montarem dados)
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
    for select using (auth.role() = 'authenticated');

-- O próprio usuário pode atualizar seu perfil (ex.: tema)
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
    for update using (auth.uid() = id);

-- Administradores podem tudo (criar/editar/excluir qualquer perfil)
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
    for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
    with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
