import {z} from 'zod';
import {readBoundedBody} from '@/lib/read-bounded-body';
import {createClient} from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const input = z.object({workspaceId: z.string().uuid(), rows: z.array(z.object({id: z.string().uuid(), caption: z.string().trim().min(1).max(2200).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))})).min(1).max(100)});
export async function POST(request: Request) {
  const s = await createClient();const {data: {user}, error} = await s.auth.getUser();
  if (error || !user) return Response.json({error: 'Sign in required.'}, {status: 401});
  // Server actions are CSRF-protected by Next; this JSON API validates same-origin explicitly.
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error: 'Use this app to import drafts.'}, {status: 403});
  if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({error: 'Send a JSON import.'}, {status: 415});
  let raw:string;try{raw=await readBoundedBody(request,1024*1024)}catch{return Response.json({error:'Import is too large or is not valid UTF-8.'},{status:413})}
  let payload: z.infer<typeof input>;
  try {payload = input.parse(JSON.parse(raw));} catch {return Response.json({error: 'Choose 1–100 valid captions, each with a unique draft ID.'}, {status: 400});}
  if (new Set(payload.rows.map(r => r.id)).size !== payload.rows.length) return Response.json({error: 'Each row needs a unique draft ID.'}, {status: 400});
  const imported = await s.rpc('import_caption_drafts', {p_workspace_id: payload.workspaceId, p_rows: payload.rows});
  if (imported.error) {
    const code = imported.error.code;
    return Response.json({error: code === '42501' ? 'Your workspace role cannot import drafts.' : code === '22023' ? 'Draft IDs conflict with saved content. Start a new import.' : 'Import could not be confirmed. Retry with this same preview.'}, {status: code === '42501' ? 403 : code === '22023' ? 409 : 503});
  }
  return Response.json({count: imported.data}, {headers: {'Cache-Control': 'private, no-store'}});
}
