'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartLine = {
  variantId: string;
  sku: string;
  name: string;
  color: string;
  size: string;
  price: number;
  quantity: number;
  maxQuantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  total: number;
  add: (line: Omit<CartLine, 'quantity'>) => void;
  syncStock: (variantId: string, maxQuantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('santorini-cart') ?? '[]') as Partial<CartLine>[];
      setLines(stored.filter((line) => line.variantId && Number(line.quantity) > 0).map((line) => ({
        variantId: String(line.variantId), sku: String(line.sku ?? ''), name: String(line.name ?? ''),
        color: String(line.color ?? ''), size: String(line.size ?? ''), price: Number(line.price) || 0,
        quantity: Math.max(1, Number(line.quantity) || 1),
        maxQuantity: Math.max(1, Number(line.maxQuantity) || Number(line.quantity) || 1),
      })));
    } catch { setLines([]); }
  }, []);

  const update = useCallback((recipe: (current: CartLine[]) => CartLine[]) => setLines((current) => {
    const next = recipe(current);
    localStorage.setItem('santorini-cart', JSON.stringify(next));
    return next;
  }), []);

  const add = useCallback((incoming: Omit<CartLine, 'quantity'>) => update((current) => {
    const limit = Math.max(0, Math.floor(incoming.maxQuantity));
    if (limit < 1) return current;
    const found = current.find((line) => line.variantId === incoming.variantId);
    return found
      ? current.map((line) => line.variantId === incoming.variantId ? { ...line, ...incoming, maxQuantity: limit, quantity: Math.min(line.quantity + 1, limit) } : line)
      : [...current, { ...incoming, maxQuantity: limit, quantity: 1 }];
  }), [update]);

  const syncStock = useCallback((variantId: string, maxQuantity: number) => update((current) => {
    const limit = Math.max(0, Math.floor(maxQuantity));
    const found = current.find((line) => line.variantId === variantId);
    if (!found) return current;
    if (limit < 1) return current.filter((line) => line.variantId !== variantId);
    if (found.maxQuantity === limit && found.quantity <= limit) return current;
    return current.map((line) => line.variantId === variantId ? { ...line, maxQuantity: limit, quantity: Math.min(line.quantity, limit) } : line);
  }), [update]);

  const remove = useCallback((variantId: string) => update((current) => current.filter((line) => line.variantId !== variantId)), [update]);
  const clear = useCallback(() => update(() => []), [update]);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    add,
    syncStock,
    remove,
    clear,
  }), [add, clear, lines, remove, syncStock]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe utilizarse dentro de CartProvider.');
  return context;
}
