"use client";
import Link from 'next/link';
import {AlertCircle} from 'lucide-react';
export default function WorkspaceError({reset}:{reset:()=>void}){return <section className="panel cd-quiet-empty" role="alert"><AlertCircle/><h1>This page couldn’t load</h1><p>Your content is still saved. Try again, or return to your workspace.</p><button onClick={reset}>Try again</button><Link href="/overview">Back to overview</Link></section>}
