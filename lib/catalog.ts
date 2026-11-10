export type Product = {
  id: string;
  variantId?: string;
  name: string;
  category: string;
  color: string;
  size: string;
  price: number;
  priceUsd?: number;
  stock: number;
};

export const initialProducts: Product[] = [
  { id: 'SAN-0001', name: 'Metallic Logo Fleece Hoodie', category: 'Hoodies', color: 'Abbey stone', size: 'XL', price: 155000, priceUsd: 100, stock: 0 },
  { id: 'SAN-0002', name: 'Metallic Logo Fleece Hoodie', category: 'Hoodies', color: 'Timber', size: 'XL', price: 0, stock: 0 },
  { id: 'SAN-0019', name: '25SS 24FW Remera', category: 'Remeras', color: 'Black', size: 'XS', price: 100750, priceUsd: 65, stock: 0 },
  { id: 'SAN-0020', name: '25SS 24FW Remera', category: 'Remeras', color: 'Black', size: 'S', price: 100750, priceUsd: 65, stock: 0 },
  { id: 'SAN-0056', name: 'North Face 700', category: 'Abrigos', color: 'Negro', size: 'M', price: 279000, priceUsd: 180, stock: 0 },
  { id: 'SAN-0058', name: 'Jordan 4 Black Cat 2025', category: 'Calzado', color: 'Negro', size: '8.5', price: 356500, priceUsd: 230, stock: 0 },
];

export const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
export const moneyUsd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
