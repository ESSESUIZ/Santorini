import type { Metadata } from 'next';
import './styles.css';
import './brand.css';
import './instagram.css';
import './experience.css';

export const metadata: Metadata = {
  title: 'Santorini | Urban essentials',
  description: 'Tienda online y operación de Santorini.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
