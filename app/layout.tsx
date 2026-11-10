import type { Metadata, Viewport } from 'next';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/700.css';
import './styles.css';
import './brand.css';
import './instagram.css';
import './experience.css';
import './customer.css';
import './product.css';
import './checkout.css';
import './polish.css';
import './brand-motion.css';
import { CartProvider } from '../components/CartProvider';

export const metadata: Metadata = {
  title: 'Santorini | Urban essentials',
  description: 'Tienda online y operación de Santorini.',
};

export const viewport: Viewport = { themeColor: '#12246B' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><CartProvider>{children}</CartProvider></body></html>;
}
