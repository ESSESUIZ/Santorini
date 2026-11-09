import ShopClient from './ShopClient';
import { getPublicCatalog } from '../../lib/catalog-server';

export const dynamic = 'force-dynamic';

export default async function Shop() {
  return <ShopClient initialProducts={await getPublicCatalog()} />;
}
