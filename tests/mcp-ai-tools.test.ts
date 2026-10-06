import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=()=>readFileSync('src/lib/mcp-server.ts','utf8');

test('ChannelDesk MCP exposes Agnes AI workflow tools',()=>{
  const s=source();
  for(const name of [
    'create_ai_content_plan',
    'generate_ai_video',
    'get_ai_generation_status',
    'list_ai_generation_jobs',
    'create_and_generate_ai_video',
    'regenerate_ai_video',
  ]) assert.match(s,new RegExp(`registerTool\\('${name}'`));
  assert.match(s,/from '\.\/agnes'/);
  assert.match(s,/version:'0\.8\.0'/);
});

test('AI generation tools preserve bounded inputs and explicit spend permissions',()=>{
  const s=source();
  assert.match(s,/brief:z\.string\(\)\.trim\(\)\.min\(8\)\.max\(3000\)/);
  assert.match(s,/seconds:z\.number\(\)\.int\(\)\.min\(4\)\.max\(12\)/);
  assert.match(s,/videoPrompt:z\.string\(\)\.min\(8\)\.max\(4000\)/);
  assert.match(s,/create_ai_content_plan'.*\.\.\.metadata\(true\)/s);
  assert.match(s,/generate_ai_video'.*\.\.\.metadata\(true\)/s);
  assert.match(s,/get_ai_generation_status'.*\.\.\.metadata\(true\)/s);
  assert.match(s,/create_and_generate_ai_video'.*\.\.\.metadata\(true\)/s);
  assert.match(s,/regenerate_ai_video'.*\.\.\.metadata\(true\)/s);
});

test('AI status exposes completed media for direct publishing workflows',()=>{
  const s=source();
  assert.match(s,/media_asset_id/);
  assert.match(s,/source_url/);
  assert.match(s,/aiJobSummary/);
});
