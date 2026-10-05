import {createHmac,timingSafeEqual} from 'node:crypto';
import {ConfigurationError} from './config';
export const CONSENT_COOKIE='cd_mcp_consent';
export function consentProof(query:string,nonce:string,userId:string){
 const key=process.env.TOKEN_ENCRYPTION_KEY;if(!key||Buffer.from(key,'base64').length!==32)throw new ConfigurationError('TOKEN_ENCRYPTION_KEY');
 return createHmac('sha256',Buffer.from(key,'base64')).update(JSON.stringify(['mcp-consent-v1',userId,query,nonce])).digest('base64url');
}
export function consentMatches(expected:string,actual:string){const a=Buffer.from(expected),b=Buffer.from(actual);return a.length===b.length&&timingSafeEqual(a,b);}
export function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
