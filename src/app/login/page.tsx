import { signIn, signUp } from "@/app/auth/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return <main className="auth-page"><section className="auth-card">
    <div className="brand auth-brand"><span>CD</span>ChannelDesk</div>
    <p className="eyebrow">SOCIAL COMMAND CENTRE</p><h1>Welcome to ChannelDesk</h1>
    <p className="muted">Sign in to manage your channels, publishing calendar and performance.</p>
    {params.error && <p className="notice error">{params.error}</p>}
    {params.message && <p className="notice">{params.message}</p>}
    <form className="auth-form"><label>Email<input name="email" type="email" required autoComplete="email"/></label>
      <label>Password<input name="password" type="password" required minLength={8} autoComplete="current-password"/></label>
      <button formAction={signIn}>Sign in</button><button className="secondary" formAction={signUp}>Create account</button>
    </form>
  </section></main>;
}
