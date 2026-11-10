import type { Metadata } from 'next';
import './styles.css';
import './brand.css';
import './instagram.css';
import './experience.css';
import './customer.css';
import './product.css';
import './checkout.css';
import './polish.css';
import { CartProvider } from '../components/CartProvider';

export const metadata: Metadata = {
  title: 'Santorini | Urban essentials',
  description: 'Tienda online y operación de Santorini.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><CartProvider>{children}</CartProvider></body></html>;
}
