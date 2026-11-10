'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/browser';
import { Brand } from './Brand';
import { useCart } from './CartProvider';

export function SiteNav() {
  const [account, setAccount] = useState<'loading' | 'guest' | 'customer' | 'admin'>('loading');
  const { count } = useCart();

  useEffect(() => {
    const supabase = createClient();
    const resolveAccount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAccount('guest'); return; }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      setAccount(profile?.role === 'admin' ? 'admin' : 'customer');
    };
    resolveAccount();
    const { data: listener } = supabase.auth.onAuthStateChange(() => resolveAccount());
    return () => listener.subscription.unsubscribe();
  }, []);

  return <nav className="site-nav">
    <Brand />
    <span>
      <Link href="/tienda">Tienda</Link>
      {account === 'admin' && <Link href="/admin">Operación</Link>}
      {account === 'guest' && <Link href="/cuenta">Iniciar sesión</Link>}
      {(account === 'customer' || account === 'admin') && <Link href="/cuenta">Mi cuenta</Link>}
      <Link className="bag-link" href="/checkout" aria-label={`Carrito con ${count} ${count === 1 ? 'producto' : 'productos'}`}>Carrito <b>{count}</b></Link>
    </span>
  </nav>;
}
