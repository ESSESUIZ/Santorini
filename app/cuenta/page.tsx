'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Brand } from '../../components/Brand';
import { AccountDashboard } from '../../components/AccountDashboard';
import { createClient } from '../../lib/supabase/browser';

export default function AccountPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setCurrentUser(data.user ? { id: data.user.id, email: data.user.email ?? '' } : null));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(mode === 'login' ? 'Ingresando…' : 'Creando tu cuenta…');
    const supabase = createClient();
    if (mode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) setMessage(error?.message ?? 'No pudimos iniciar sesión.');
      else { setCurrentUser({ id: data.user.id, email: data.user.email ?? email }); setMessage('Sesión iniciada correctamente.'); }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/cuenta` },
      });
      if (error) setMessage(error.message);
      else if (data.session && data.user) { setCurrentUser({ id: data.user.id, email: data.user.email ?? email }); setMessage('Tu cuenta ya está activa.'); }
      else setMessage('Te enviamos un email para confirmar tu cuenta.');
    }
    setBusy(false);
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    setCurrentUser(null);
    setMessage('Cerraste sesión. Podés seguir recorriendo la tienda.');
  };

  return <main className="account-page">
    <nav><Brand /><span><Link href="/tienda">Seguir comprando</Link></span></nav>
    <section className="account-shell">
      <div className="account-visual" aria-hidden="true"><img src="/santorini-island-hero.png" alt="" /></div>
      <div className="account-panel">
        <p className="eyebrow">CUENTA SANTORINI</p>
        {currentUser ? <AccountDashboard userId={currentUser.id} email={currentUser.email} onSignOut={signOut} /> : <>
          <div className="account-tabs" role="tablist" aria-label="Acceso a cuenta">
            <button role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMessage(''); }}>Iniciar sesión</button>
            <button role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMessage(''); }}>Crear cuenta</button>
          </div>
          <h1>{mode === 'login' ? <>Volvé a<br />Santorini.</> : <>Tu estilo,<br />en un lugar.</>}</h1>
          <form onSubmit={submit}>
            {mode === 'register' && <label>Nombre<input type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></label>}
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Contraseña<input type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="button" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear mi cuenta'} <span>↗</span></button>
          </form>
          {mode === 'login' && <button className="forgot-link" type="button" onClick={async () => { if (!email) { setMessage('Ingresá tu email para recuperar la contraseña.'); return; } setBusy(true); const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/cuenta/restablecer` }); setMessage(error ? error.message : 'Te enviamos un enlace para crear una nueva contraseña.'); setBusy(false); }}>Olvidé mi contraseña</button>}
          <p className="account-note">No necesitás una cuenta para recorrer la tienda.</p>
        </>}
        {message && <p className="account-message" role="status">{message}</p>}
      </div>
    </section>
  </main>;
}
