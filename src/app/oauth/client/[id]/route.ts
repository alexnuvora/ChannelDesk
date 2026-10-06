import {admin} from '@/lib/mcp-oauth';
import {appOrigin} from '@/lib/config';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[A-Za-z0-9_-]{43}$/.test(id))return Response.json({error:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
 const clientId=appOrigin()+'/oauth/client/'+id;
 const {data,error}=await admin().from('mcp_oauth_clients').select('client_id,client_name,redirect_uris,grant_types,response_types,token_endpoint_auth_method,application_type,scope,client_uri,logo_uri,software_id,software_version,issued_at').eq('client_id',clientId).is('revoked_at',null).maybeSingle();
 if(error)return Response.json({error:'server_error'},{status:500,headers:{'Cache-Control':'no-store'}});
 if(!data)return Response.json({error:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
 const issuedAt=Math.floor(new Date(data.issued_at).getTime()/1000);
 return Response.json({
  client_id:data.client_id,
  client_id_issued_at:issuedAt,
  client_name:data.client_name,
  redirect_uris:data.redirect_uris,
  grant_types:data.grant_types,
  response_types:data.response_types,
  token_endpoint_auth_method:data.token_endpoint_auth_method,
  application_type:data.application_type,
  scope:data.scope,
  ...(data.client_uri?{client_uri:data.client_uri}:{}),
  ...(data.logo_uri?{logo_uri:data.logo_uri}:{}),
  ...(data.software_id?{software_id:data.software_id}:{}),
  ...(data.software_version?{software_version:data.software_version}:{})
 },{headers:{'Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'}});
}
