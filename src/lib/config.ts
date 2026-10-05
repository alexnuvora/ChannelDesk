export const CHANNELDESK_ORIGIN = 'https://channel-desk-61xl.vercel.app';
export class ConfigurationError extends Error {
  constructor(public readonly setting: string) { super(`ChannelDesk needs ${setting} configured on the server.`); this.name='ConfigurationError'; }
}
export function appOrigin() {
  const value=process.env.NEXT_PUBLIC_APP_URL || process.env.CHANNELDESK_PUBLIC_URL || CHANNELDESK_ORIGIN;
  let url:URL; try { url=new URL(value); } catch { throw new ConfigurationError('NEXT_PUBLIC_APP_URL'); }
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||(url.protocol!=='https:'&&!(process.env.NODE_ENV==='development'&&url.protocol==='http:'&&url.hostname==='localhost'))) throw new ConfigurationError('NEXT_PUBLIC_APP_URL');
  return url.origin;
}
export function supabaseConfig() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url) throw new ConfigurationError('NEXT_PUBLIC_SUPABASE_URL');
  if(!key) throw new ConfigurationError('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return {url,key};
}
export function requireServerDatabaseConfig() {
  const {url}=supabaseConfig();
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if(!key) throw new ConfigurationError('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)');
  return {url,key};
}
export function safeNext(value:unknown) {
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x1f\x7f]/.test(value))return '/';
  const origin='https://local.invalid';
  try { const url=new URL(value,origin);return url.origin===origin?url.pathname+url.search+url.hash:'/'; } catch { return '/'; }
}
export function logFailure(event:string,error:unknown) {
  const e=error as {name?:unknown;code?:unknown;setting?:unknown};
  // No URLs, request bodies, cookies, provider responses, codes or tokens in logs.
  console.error(JSON.stringify({event,error:error instanceof Error?error.name:'DatabaseError',code:typeof e?.code==='string'?e.code.slice(0,40):undefined,setting:error instanceof ConfigurationError?error.setting:undefined}));
}
