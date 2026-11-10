'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Brand } from '../../../components/Brand';
import { createClient } from '../../../lib/supabase/browser';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await createClient().auth.updateUser({ password });
    setMessage(error ? error.message : 'Contraseña actualizada. Ya podés ingresar normalmente.');
  };
  return <main className="account-page"><nav><Brand /><span><Link href="/cuenta">Volver</Link></span></nav><section className="reset-shell"><form className="reset-form" onSubmit={submit}><p className="eyebrow">SEGURIDAD</p><h1>Nueva<br />contraseña.</h1><label>Contraseña<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button">Actualizar contraseña <span>↗</span></button>{message && <p role="status">{message}</p>}</form></section></main>;
}
