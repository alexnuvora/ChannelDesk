import {appendFile} from 'node:fs/promises';

if(process.env.SUPABASE_SERVICE_ROLE_KEY){
  console.log('Using configured render-worker credential.');
  process.exit(0);
}

const project=process.env.SUPABASE_PROJECT_ID;
const token=process.env.SUPABASE_ACCESS_TOKEN;
const envFile=process.env.GITHUB_ENV;
if(project!=='zmwfyrqbgtvtuajbjnzm'||!token||!envFile){
  throw Error('Supabase project or Actions access token is unavailable.');
}

const response=await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`,{
  headers:{Authorization:`Bearer ${token}`},
  redirect:'error',
  signal:AbortSignal.timeout(30000)
});
if(!response.ok)throw Error(`Could not retrieve Supabase API keys (HTTP ${response.status}).`);
const keys=await response.json();
if(!Array.isArray(keys))throw Error('Unexpected Supabase API keys response.');
const key=keys.find(item=>item?.name==='service_role'&&typeof item.api_key==='string')?.api_key;
if(!key||/[\r\n]/.test(key))throw Error('Supabase service role key is unavailable.');

// Never print the key. Mask it before exposing it to later workflow steps.
process.stdout.write(`::add-mask::${key}\n`);
await appendFile(envFile,`SUPABASE_SERVICE_ROLE_KEY=${key}\n`,{mode:0o600});
console.log('Resolved render-worker credential.');
