import { notFound } from 'next/navigation';
import { SiteNav } from '../../../components/SiteNav';
import { getProductBySku } from '../../../lib/catalog-server';
import ProductDetailClient from './ProductDetailClient';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = await getProductBySku(sku);
  if (!product) notFound();
  return <main className="product-page"><SiteNav /><ProductDetailClient product={product} /></main>;
}
