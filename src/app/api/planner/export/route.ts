import {createClient} from '@/lib/supabase/server';
import {plannerCalendar, plannerCsv, type ExportPublication} from '@/lib/planner-export';

export const dynamic = 'force-dynamic';
const STATES = ['draft', 'rejected', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'cancelled', 'needs_review'];

export async function GET(request: Request) {
  const s = await createClient();
  const {data: {user}, error: authError} = await s.auth.getUser();
  if (authError || !user) return new Response('Sign in required', {status: 401});
  const params = new URL(request.url).searchParams;
  const format = params.get('format') || 'csv';
  const state = params.get('state');
  if (!['csv', 'ics'].includes(format) || (state && !STATES.includes(state))) return new Response('Choose csv or ics and a valid publication status.', {status: 400});
  const workspaceId = params.get('workspaceId');
  let membership = s.from('workspace_members').select('workspace_id').eq('user_id', user.id);
  if (workspaceId) membership = membership.eq('workspace_id', workspaceId);
  const {data: member, error: memberError} = await membership.limit(1).maybeSingle();
  if (memberError) return new Response('Could not verify workspace access', {status: 503});
  if (!member) return new Response('Workspace not found', {status: 404});
  const items: ExportPublication[] = [];
  // Pagination avoids silently exporting only the planner's first 200 records.
  for (let offset = 0; offset < 10000; offset += 500) {
    let query = s.from('publications').select('id,text,state,scheduled_for,created_at,updated_at,publication_targets(state,external_url,social_connections(network,display_name))').eq('workspace_id', member.workspace_id);
    if (state) query = query.eq('state', state);
    const {data, error} = await query.order('created_at', {ascending: true}).order('id', {ascending: true}).range(offset, offset + 499);
    if (error) return new Response('Could not export your calendar', {status: 503});
    items.push(...(data || []) as unknown as ExportPublication[]);
    if (!data || data.length < 500) {
      const body = format === 'ics' ? plannerCalendar(items) : plannerCsv(items);
      return new Response(body, {headers: {
        'Content-Type': format === 'ics' ? 'text/calendar; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="channeldesk-planner.${format}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      }});
    }
  }
  return new Response('Export is too large. Filter by publication status and retry.', {status: 422});
}
