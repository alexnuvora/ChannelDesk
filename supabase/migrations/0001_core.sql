create extension if not exists pgcrypto;

create table workspaces (id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, created_at timestamptz not null default now());
create table workspace_members (workspace_id uuid references workspaces(id) on delete cascade, user_id uuid not null, role text not null check(role in ('owner','admin','editor','analyst','approver')), primary key(workspace_id,user_id));
create table social_connections (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces(id) on delete cascade, network text not null, external_account_id text not null, display_name text not null, token_ciphertext text not null, refresh_token_ciphertext text, scopes text[] not null default '{}', token_expires_at timestamptz, active boolean not null default true, created_at timestamptz not null default now(), unique(workspace_id,network,external_account_id));
create table media_assets (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces(id) on delete cascade, storage_key text not null, mime_type text not null, width int, height int, duration_ms bigint, source_url text, rights_basis text, rights_evidence text, created_at timestamptz not null default now());
create table publications (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces(id) on delete cascade, author_id uuid not null, text text not null default '', state text not null default 'draft' check(state in ('draft','pending_approval','scheduled','publishing','published','failed','cancelled')), scheduled_for timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table publication_targets (id uuid primary key default gen_random_uuid(), publication_id uuid not null references publications(id) on delete cascade, connection_id uuid not null references social_connections(id) on delete cascade, network_payload jsonb not null default '{}', state text not null default 'draft', external_post_id text, external_url text, error_code text, error_message text, attempts int not null default 0, idempotency_key text not null unique, published_at timestamptz);
create table publication_media (publication_id uuid references publications(id) on delete cascade, media_id uuid references media_assets(id) on delete cascade, position int not null default 0, primary key(publication_id,media_id));
create table audit_events (id bigint generated always as identity primary key, workspace_id uuid not null references workspaces(id) on delete cascade, actor_id uuid, action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now());

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table social_connections enable row level security;
alter table media_assets enable row level security;
alter table publications enable row level security;
alter table publication_targets enable row level security;
alter table publication_media enable row level security;
alter table audit_events enable row level security;
