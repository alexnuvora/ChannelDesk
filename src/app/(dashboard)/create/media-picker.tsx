'use client';
import Link from 'next/link';
import {useState} from 'react';
export type MediaAsset={id:string;source_url:string|null;storage_key:string;mime_type:string;created_at:string};
export function MediaPicker({assets,name='mediaAssetId'}:{assets:MediaAsset[];name?:string}){
 const [selected,setSelected]=useState(assets[0]?.id||'');
 if(!assets.length)return <div className="media-picker-empty"><b>No videos in your Media Library yet</b><span>Upload a video once, then reuse it across your connected channels.</span><Link className="button" href="/media">Upload media</Link></div>;
 return <fieldset className="media-picker"><legend>Choose media</legend><input type="hidden" name={name} value={selected} required/><div className="media-picker-grid">{assets.map(a=>{const filename=a.storage_key.split('/').pop()||'Video';const active=selected===a.id;return <button type="button" key={a.id} className={'media-choice'+(active?' selected':'')} onClick={()=>setSelected(a.id)} aria-pressed={active}><span className="media-choice-preview">{a.source_url?<video src={a.source_url} preload="metadata" muted/>:<span>VIDEO</span>}</span><span className="media-choice-copy"><b>{filename}</b><small>{a.mime_type.replace('video/','').toUpperCase()} · {new Date(a.created_at).toLocaleDateString('en-GB')}</small></span><span className="media-choice-check">{active?'✓ Selected':'Select'}</span></button>})}</div><div className="media-picker-footer"><span className="muted">Your original stays safely in Media Library.</span><Link href="/media">Upload another</Link></div></fieldset>;
}