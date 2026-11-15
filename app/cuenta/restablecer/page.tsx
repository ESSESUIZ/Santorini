'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Brand } from '../../../components/Brand';
import { createClient } from '../../../lib/supabase/browser';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) { setMessage('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setMessage(error ? 'El enlace venció o no es válido. Solicitá uno nuevo.' : 'Contraseña actualizada. Ya podés ingresar normalmente.');
    setBusy(false);
  };
  return <main className="account-page"><nav><Brand /><span><Link href="/cuenta">Volver</Link></span></nav><section className="reset-shell"><form className="reset-form" onSubmit={submit}><p className="eyebrow">SEGURIDAD · ENLACE DE UN SOLO USO</p><h1>Nueva<br />contraseña.</h1><p className="account-copy">Usá al menos 8 caracteres y elegí una clave que no reutilices en otros sitios.</p><label>Contraseña nueva<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Repetir contraseña<input type="password" minLength={8} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label><button className="button" disabled={busy}>{busy ? 'Actualizando…' : 'Actualizar contraseña'} <span>↗</span></button>{message && <p role="status">{message}</p>}</form></section></main>;
}
