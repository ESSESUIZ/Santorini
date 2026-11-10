'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '../../../components/Brand';
import { createClient } from '../../../lib/supabase/browser';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('Validando acceso…');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) { setMessage(error?.message ?? 'No fue posible verificar el usuario.'); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (profileError || !profile || !['admin', 'sales', 'warehouse'].includes(profile.role)) {
        await supabase.auth.signOut();
        setMessage('Tu usuario no tiene un rol operativo autorizado.');
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch { setMessage('No fue posible conectar con Supabase.'); }
  };
  return <main className="login"><nav><Brand /><span><Link href="/">Volver</Link></span></nav><form className="login-form" onSubmit={submit}><p className="eyebrow">EQUIPO SANTORINI</p><h1>Control<br />de stock.</h1><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button">Ingresar <span>↗</span></button>{message && <p className="login-message">{message}</p>}<p className="login-footnote">Acceso exclusivo para administración, ventas y depósito.</p></form></main>;
}
