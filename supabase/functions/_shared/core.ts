import {createClient} from 'npm:@supabase/supabase-js@2';
export const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
export function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})}
export function service(){const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Supabase service configuration missing');return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function user(req:Request){const auth=req.headers.get('Authorization');if(!auth)throw new Error('Authentication required');const db=service();const {data,error}=await db.auth.getUser(auth.replace(/^Bearer\s+/i,''));if(error||!data.user)throw new Error('Authentication required');return data.user}
