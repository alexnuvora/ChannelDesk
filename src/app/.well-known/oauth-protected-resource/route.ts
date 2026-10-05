import { MCP_SCOPES, issuer, mcpResource } from "@/lib/mcp-oauth";
export const dynamic="force-dynamic";
export async function GET(){
 return Response.json({resource:mcpResource(),authorization_servers:[issuer()],scopes_supported:MCP_SCOPES,resource_documentation:issuer()+"/settings"},{headers:{"cache-control":"public, max-age=300","access-control-allow-origin":"*"}});
}
