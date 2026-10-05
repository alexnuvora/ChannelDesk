create table if not exists public.mcp_oauth_codes (
  code_hash text primary key,
  user_id uuid not null,
  client_id text not null,
  redirect_uri text not null,
  resource text not null,
  scope text not null default '',
  code_challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.mcp_oauth_tokens (
  token_hash text primary key,
  user_id uuid not null,
  client_id text not null,
  resource text not null,
  scope text not null default '',
  token_type text not null check (token_type in ('access','refresh')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mcp_oauth_tokens_user_idx on public.mcp_oauth_tokens(user_id);
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;
revoke all on public.mcp_oauth_codes from public, anon, authenticated;
revoke all on public.mcp_oauth_tokens from public, anon, authenticated;
