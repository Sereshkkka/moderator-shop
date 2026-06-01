create extension if not exists pgcrypto;

create table if not exists companies (
    id text primary key,
    name text not null,
    accent_color text not null default '#8b5cf6',
    webhook_url text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists roles (
    id text primary key,
    label text not null,
    tier numeric not null default 1,
    color text not null default '#94a3b8',
    perms jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists users (
    id text primary key,
    username text not null,
    password_hash text not null,
    coins integer not null default 0,
    role_id text not null references roles(id),
    company_id text not null references companies(id),
    server_roles jsonb not null default '{}'::jsonb,
    reprimands jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    cart jsonb not null default '[]'::jsonb,
    is_archived boolean not null default false,
    is_pending_activation boolean not null default false,
    must_change_password boolean not null default false,
    account_status text not null default 'активен',
    discord_id text not null default '',
    discord_username text not null default '',
    discord_avatar_url text not null default '',
    invite_code_id text null,
    unique (company_id, username)
);

create table if not exists user_company_access (
    user_id text not null references users(id) on delete cascade,
    company_id text not null references companies(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, company_id)
);

create table if not exists codes (
    id text primary key,
    code text not null unique,
    company_id text not null references companies(id) on delete cascade,
    target_username text not null,
    is_used boolean not null default false,
    created_by text null references users(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists items (
    id text primary key,
    company_id text not null references companies(id) on delete cascade,
    name text not null,
    description text not null default '',
    price integer not null default 0,
    item_type text not null default 'item',
    image text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists logs (
    id text primary key,
    user_id text null references users(id) on delete set null,
    modifier_id text null references users(id) on delete set null,
    company_id text not null references companies(id) on delete cascade,
    old_balance integer not null default 0,
    new_balance integer not null default 0,
    type text not null,
    reason text not null default '',
    purchase_details jsonb null,
    created_at timestamptz not null default now()
);

create table if not exists system_config (
    id boolean primary key default true,
    webhook_url text not null default '',
    avatar_url_template text not null default 'https://skins.mcskill.net/?name=insert&mode=5&fx=size&fy=size',
    bonus_requests jsonb not null default '[]'::jsonb,
    bonus_permissions_initialized boolean not null default false,
    constraint system_config_singleton check (id = true)
);

insert into system_config (id, webhook_url, avatar_url_template)
values (true, '', 'https://skins.mcskill.net/?name=insert&mode=5&fx=size&fy=size')
on conflict (id) do nothing;

insert into companies (id, name, webhook_url)
values ('comp_initial', 'Главный Сервер', '')
on conflict (id) do nothing;

insert into roles (id, label, tier, color, perms) values
('waiting', 'Ожидание', 0, '#f59e0b', '[]'::jsonb),
('helper', 'Хелпер', 1, '#10b881', '["access_bonuses"]'::jsonb),
('moderator', 'Модератор', 2, '#38bdf8', '["access_mod_panel", "access_bonuses"]'::jsonb),
('ST-moderator', 'Ст-Модератор', 3, '#6366f1', '["access_mod_panel", "view_logs", "access_archive", "access_bonuses"]'::jsonb),
('gd', 'ГД', 4, '#10b981', '["access_mod_panel", "view_logs", "access_archive", "access_bonuses", "review_bonuses"]'::jsonb),
('GM', 'Гл. Модератор', 4, '#a855f7', '["access_mod_panel", "view_logs", "access_archive", "access_bonuses", "review_bonuses"]'::jsonb),
('kurator', 'Куратор', 5, '#eab308', '["access_mod_panel", "view_logs", "edit_balance", "access_archive", "access_bonuses", "review_bonuses"]'::jsonb),
('tech_admin', 'Тех-Админ', 6, '#06b6d4', '["access_mod_panel", "manage_store", "view_logs", "edit_balance", "access_archive", "access_bonuses", "review_bonuses"]'::jsonb),
('server_admin', 'Админ Сервера', 7, '#f59e0b', '["access_mod_panel", "generate_codes", "manage_store", "view_logs", "edit_balance", "edit_roles", "access_archive", "access_bonuses", "review_bonuses"]'::jsonb),
('admin', 'Гл. Администратор', 8, '#ec4899', '["all"]'::jsonb)
on conflict (id) do update set
    label = excluded.label,
    tier = excluded.tier,
    color = excluded.color,
    perms = excluded.perms;

insert into users (
    id,
    username,
    password_hash,
    coins,
    role_id,
    company_id,
    cart,
    is_archived,
    is_pending_activation,
    must_change_password,
    account_status,
    discord_id,
    discord_username,
    discord_avatar_url
) values (
    gen_random_uuid()::text,
    'sereshkkka',
    'b56f34b92977b77bd09c659bc863ba2f997fb1a439627d531a9fd3e3eb3b30bc',
    0,
    'admin',
    'comp_initial',
    '[]'::jsonb,
    false,
    false,
    false,
    'активен',
    '',
    '',
    ''
)
on conflict do nothing;

create index if not exists idx_users_company on users(company_id);
create index if not exists idx_users_role on users(role_id);
create index if not exists idx_codes_company on codes(company_id);
create index if not exists idx_items_company on items(company_id);
create index if not exists idx_logs_company_created on logs(company_id, created_at desc);
