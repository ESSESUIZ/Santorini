'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type CartLine = {
  variantId: string;
  sku: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (line: Omit<CartLine, 'quantity'>) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    try { setLines(JSON.parse(localStorage.getItem('santorini-cart') ?? '[]')); } catch { setLines([]); }
  }, []);

  const update = (recipe: (current: CartLine[]) => CartLine[]) => setLines((current) => {
    const next = recipe(current);
    localStorage.setItem('santorini-cart', JSON.stringify(next));
    return next;
  });

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    add: (incoming) => update((current) => {
      const found = current.find((line) => line.variantId === incoming.variantId);
      return found
        ? current.map((line) => line.variantId === incoming.variantId ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { ...incoming, quantity: 1 }];
    }),
    remove: (variantId) => update((current) => current.filter((line) => line.variantId !== variantId)),
    clear: () => update(() => []),
  }), [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe utilizarse dentro de CartProvider.');
  return context;
}
