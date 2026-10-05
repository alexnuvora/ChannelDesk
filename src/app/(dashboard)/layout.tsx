import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {AppShell} from '@/components/app-shell';
export const dynamic='force-dynamic';
export default async function DashboardLayout({children}:{children:React.ReactNode}){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login');return <AppShell>{children}</AppShell>;}
