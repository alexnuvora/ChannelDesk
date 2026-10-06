import { MCP_SCOPES, issuer } from "@/lib/oauth-validation";
export const dynamic="force-dynamic";
export async function GET(){
 const base=issuer();
 return Response.json({issuer:base,authorization_endpoint:base+"/oauth/authorize",token_endpoint:base+"/oauth/token",registration_endpoint:base+"/oauth/register",response_types_supported:["code"],grant_types_supported:["authorization_code","refresh_token"],code_challenge_methods_supported:["S256"],token_endpoint_auth_methods_supported:["none"],scopes_supported:MCP_SCOPES,client_id_metadata_document_supported:true,authorization_response_iss_parameter_supported:true},{headers:{"cache-control":"public, max-age=300","access-control-allow-origin":"*"}});
}
