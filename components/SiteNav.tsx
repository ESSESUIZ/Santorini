'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase/browser';
import { Brand } from './Brand';
import { useCart } from './CartProvider';

export function SiteNav() {
  const [account, setAccount] = useState<'loading' | 'guest' | 'customer' | 'admin'>('loading');
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useCart();
  const pathname = usePathname();

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

  useEffect(() => setMenuOpen(false), [pathname]);

  return <nav className="site-nav">
    <Brand />
    <div className={`site-nav-links${menuOpen ? ' is-open' : ''}`} id="site-navigation">
      <Link href="/tienda" aria-current={pathname.startsWith('/tienda') ? 'page' : undefined}>Tienda</Link>
      {account === 'admin' && <Link href="/admin" aria-current={pathname.startsWith('/admin') ? 'page' : undefined}>Operación</Link>}
      {account === 'guest' && <Link href="/cuenta" aria-current={pathname.startsWith('/cuenta') ? 'page' : undefined}>Iniciar sesión</Link>}
      {(account === 'customer' || account === 'admin') && <Link href="/cuenta" aria-current={pathname.startsWith('/cuenta') ? 'page' : undefined}>Mi cuenta</Link>}
    </div>
    <div className="site-nav-actions">
      <Link className="bag-link" href="/checkout" aria-label={`Carrito con ${count} ${count === 1 ? 'producto' : 'productos'}`}>Carrito <b>{count}</b></Link>
      <button className="site-nav-menu" type="button" aria-expanded={menuOpen} aria-controls="site-navigation" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenuOpen((value) => !value)}>
        <span aria-hidden="true" /><span aria-hidden="true" />
      </button>
    </div>
  </nav>;
}
