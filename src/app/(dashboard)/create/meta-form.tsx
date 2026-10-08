'use client';
import {useState} from 'react';
import {useFormStatus} from 'react-dom';
import {submitMeta} from './actions';

type Account={id:string;display_name:string;workspace_id:string;network:string;scopes:string[]};
function Submit({disabled}:{disabled:boolean}){const {pending}=useFormStatus();return <button type="submit" className="publish-button" disabled={pending||disabled}>{pending?'Publishing…':'Publish now'}</button>;}
export function MetaForm({accounts,requestId,network}:{accounts:Account[];requestId:string;network:'facebook'|'instagram'}){
 const [connectionId,setConnectionId]=useState(accounts.length===1?accounts[0].id:'');
 const [text,setText]=useState('');
 const [mediaUrl,setMediaUrl]=useState('');
 const selected=accounts.find(a=>a.id===connectionId);
 const permission=network==='facebook'?'pages_manage_posts':'instagram_content_publish';
 const permitted=!!selected&&Array.isArray(selected.scopes)&&selected.scopes.includes(permission);
 const valid=!!text.trim()||!!mediaUrl.trim();
 return <form action={submitMeta} className="auth-form publish-form">
  <input type="hidden" name="network" value={network}/><input type="hidden" name="requestId" value={requestId}/>
  <label>Publish to<select name="connectionId" value={connectionId} required onChange={e=>setConnectionId(e.target.value)}><option value="" disabled>Choose {network==='facebook'?'Facebook Page':'Instagram account'}</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.display_name}</option>)}</select></label>
  {selected&&!permitted&&<p className="notice error">This account has not granted {permission}. Reconnect it in Social Channels.</p>}
  <label>{network==='facebook'?'Post text':'Caption'}<textarea name="text" value={text} onChange={e=>setText(e.target.value)} className="composer compact-composer" maxLength={network==='facebook'?5000:2200} placeholder="Write your post…"/></label>
  <label>{network==='facebook'?'Public image URL (optional)':'Public image or video URL (required)'}<input type="url" name="mediaUrl" value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} required={network==='instagram'} placeholder="https://example.com/image.jpg" pattern="https://.*"/></label>
  <p className="form-hint">{network==='facebook'?'Publish a text post or optionally attach a publicly accessible image.':'Instagram publishing requires a publicly accessible HTTPS media URL. This flow will be expanded to select files from Media Library.'} Posts are sent immediately; Meta scheduling is not yet enabled.</p>
  <div className="publish-actions"><Submit disabled={!permitted||!valid||(network==='instagram'&&!mediaUrl.trim())}/></div>
  {(!permitted||!valid||(network==='instagram'&&!mediaUrl.trim()))&&<p className="form-hint">{!connectionId?'Choose an account to continue.':!permitted?'Reconnect the account with publishing permission.':'Add the required post content before publishing.'}</p>}
 </form>;
}
