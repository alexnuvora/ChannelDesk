import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('authorization server advertises RFC 7591 dynamic registration without removing CIMD',()=>{
 const route=readFileSync('src/app/.well-known/oauth-authorization-server/route.ts','utf8');
 assert.match(route,/registration_endpoint:base\+"\/oauth\/register"/);
 assert.match(route,/client_id_metadata_document_supported:true/);
 assert.match(route,/token_endpoint_auth_methods_supported:\["none"\]/);
 assert.match(route,/code_challenge_methods_supported:\["S256"\]/);
});

test('dynamic registration is public-client PKCE only and validates redirects',()=>{
 const route=readFileSync('src/app/oauth/register/route.ts','utf8');
 assert.match(route,/token_endpoint_auth_method "none"/);
 assert.match(route,/validRedirect/);
 assert.match(route,/application_type/);
 assert.match(route,/register_mcp_oauth_client/);
 assert.match(route,/registration_fingerprint/);
 assert.match(route,/Access-Control-Allow-Origin/);
});

test('registered MCP clients are persisted privately and rate limited atomically',()=>{
 const sql=readFileSync('supabase/migrations/20261006055000_mcp_dynamic_client_registration.sql','utf8');
 assert.match(sql,/create table if not exists public\.mcp_oauth_clients/);
 assert.match(sql,/alter table public\.mcp_oauth_clients enable row level security/);
 assert.match(sql,/revoke all on public\.mcp_oauth_clients from public,anon,authenticated/);
 assert.match(sql,/grant all on public\.mcp_oauth_clients to service_role/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/per_source>=20/);
 assert.match(sql,/global_recent>=120/);
});

test('OAuth validation supports registered ChannelDesk client metadata plus existing ChatGPT CIMD',()=>{
 const validation=readFileSync('src/lib/oauth-validation.ts','utf8');
 const oauth=readFileSync('src/lib/mcp-oauth.ts','utf8');
 assert.match(validation,/CHATGPT_CLIENT_ID/);
 assert.match(validation,/\/oauth\\\/client/);
 assert.match(validation,/localhost/);
 assert.match(validation,/127\.0\.0\.1/);
 assert.match(validation,/requestedScope/);
 assert.match(oauth,/activeClientId/);
 assert.match(oauth,/mcp_oauth_clients/);
});

test('token exchange rejects revoked or unknown dynamic clients',()=>{
 const token=readFileSync('src/app/oauth/token/route.ts','utf8');
 assert.match(token,/await activeClientId\(clientId\)/);
 assert.doesNotMatch(token,/if\(!validClientId\(clientId\)\)/);
});

test('consent UI names the requesting MCP client instead of hard-coding ChatGPT',()=>{
 const authorize=readFileSync('src/app/oauth/authorize/route.ts','utf8');
 assert.match(authorize,/client\.clientName/);
 assert.match(authorize,/verifyClientMetadata\(q\.clientId,q\.redirect,q\.scope\)/);
 assert.match(authorize,/Return to your MCP client/);
});
